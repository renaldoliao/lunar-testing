import { applyOp } from "./ops";
import { isLive, orderPieces, sizeIndex, uid, type Mine, type Order, type PublicView, type State, type Thread } from "./store";

/*
 * The customer side of the shop. These are the only things a customer can do,
 * and the only data they can ever see. The server runs these same functions.
 */
export type COp =
  | { t: "place"; order: Order }
  | { t: "say"; thread: string; token: string; text: string; name?: string | undefined; phone?: string | undefined }
  | { t: "cancel"; id: string; token: string }
  | { t: "read"; thread: string; token: string };
type Result = { state: State } | { error: string };

export function publicView(s: State): PublicView {
  const idx = sizeIndex(s.products);
  const load: Record<string, number> = {};
  s.orders.forEach((o) => { if (isLive(o)) load[o.date] = (load[o.date] ?? 0) + orderPieces(o, idx); });
  return { products: s.products, closed: s.closed, days: s.days ?? {}, load };
}

export function mineView(s: State, keys: { orders: { id: string; token: string }[]; threads: { id: string; token: string }[] }): Mine {
  const ok = (id: string, token: string, list: { id: string; token: string }[]) => list.some((k) => k.id === id && k.token === token && !!token);
  const orders = s.orders.filter((o) => o.token && ok(o.id, o.token, keys.orders)).map((o) => ({ ...o, picked: !!s.done[o.id] }));
  const ids = new Set(orders.map((o) => o.id));
  const threads = Object.values(s.threads ?? {}).filter((t) => ok(t.id, t.token, keys.threads) || (t.orderId && ids.has(t.orderId)));
  return { orders, threads };
}

const clean = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export function applyCustomer(s: State, op: COp, now: number): Result {
  switch (op.t) {
    case "place": {
      const o = op.order;
      if (!o.token || o.token.length < 16) return { error: "Please refresh the page and try again." };
      if (!clean(o.name, 80)) return { error: "Add your name." };
      // A customer can only ever place a new, unconfirmed online order.
      const order: Order = { id: o.id, date: o.date, time: o.time, name: clean(o.name, 80), phone: clean(o.phone, 30), items: o.items.slice(0, 30).map((i) => ({ code: String(i.code), qty: Math.max(1, Math.min(99, Number(i.qty) || 1)) })), note: clean(o.note, 300), source: "online", text: !!o.text, pending: true, placed: now, token: o.token };
      const res = applyOp(s, { t: "add", order });
      if ("error" in res) return res;
      const thread: Thread = { id: "o-" + o.id, token: o.token, name: order.name, phone: order.phone, orderId: o.id, at: now, staffSeen: 1, custSeen: 0,
        msgs: [{ id: uid(), from: "bakery", text: `Thank you, ${order.name.split(" ")[0]}! We have your order and will confirm it shortly. Message us here if you need anything.`, at: now }] };
      return { state: { ...res.state, threads: { ...(res.state.threads ?? {}), [thread.id]: thread } } };
    }
    case "say": {
      const text = clean(op.text, 1000);
      if (!text) return { error: "Write a message first." };
      const threads = { ...(s.threads ?? {}) };
      let th = threads[op.thread];
      if (th && th.token !== op.token) return { error: "That conversation could not be found." };
      if (!th) {
        if (!op.token || op.token.length < 16 || !/^c-/.test(op.thread)) return { error: "Please refresh the page and try again." };
        if (Object.keys(threads).length > 2000) return { error: "Messages are paused right now. Please email us." };
        th = { id: op.thread, token: op.token, name: clean(op.name, 80) || "Website visitor", phone: clean(op.phone, 30) || undefined, msgs: [], staffSeen: 0, custSeen: 0, at: now };
      }
      if (th.msgs.length >= 300) return { error: "This conversation is full. Please start a new one." };
      if (op.name && th.name === "Website visitor") th = { ...th, name: clean(op.name, 80) };
      const msgs = [...th.msgs, { id: uid(), from: "customer" as const, text, at: now }];
      threads[th.id] = { ...th, msgs, custSeen: msgs.length, at: now };
      return { state: { ...s, threads } };
    }
    case "cancel": {
      const o = s.orders.find((x) => x.id === op.id);
      if (!o || !o.token || o.token !== op.token) return { error: "That order could not be found." };
      if (o.cancelled) return { state: s };
      if (s.done[o.id]) return { error: "This order was already picked up." };
      if (o.ready) return { error: "Your boxes are already baked. Please message us instead." };
      let out: State = { ...s, orders: s.orders.map((x) => (x.id === o.id ? { ...x, cancelled: true } : x)) };
      const th = Object.values(out.threads ?? {}).find((t) => t.orderId === o.id);
      if (th) {
        const msgs = [...th.msgs, { id: uid(), from: "customer" as const, text: "I cancelled this order.", at: now }];
        out = { ...out, threads: { ...out.threads, [th.id]: { ...th, msgs, custSeen: msgs.length, at: now } } };
      }
      return { state: out };
    }
    case "read": {
      const th = s.threads?.[op.thread];
      if (!th || th.token !== op.token || th.custSeen === th.msgs.length) return { state: s };
      return { state: { ...s, threads: { ...s.threads, [th.id]: { ...th, custSeen: th.msgs.length } } } };
    }
  }
}

export function isCOp(x: unknown): x is COp {
  if (!x || typeof x !== "object") return false;
  const o = x as { t?: unknown; order?: unknown; thread?: unknown; token?: unknown; text?: unknown; id?: unknown };
  switch (o.t) {
    case "place": return !!o.order && typeof o.order === "object" && Array.isArray((o.order as Order).items) && typeof (o.order as Order).id === "string";
    case "say": return typeof o.thread === "string" && typeof o.token === "string" && typeof o.text === "string";
    case "cancel": return typeof o.id === "string" && typeof o.token === "string";
    case "read": return typeof o.thread === "string" && typeof o.token === "string";
    default: return false;
  }
}
