import { DAILY_LIMIT, fmtTime, isLive, orderPieces, parse, sizeIndex, uid, type DayInfo, type Order, type Product, type State, type Thread } from "./store";

/*
 * Every change the bakery makes is one of these small "operations".
 * The same function applies them in the browser (so the screen updates at once)
 * and on the server (so every device ends up with the same result, in the same order).
 * Some of them also write to the customer, so they see the change on their side.
 */
export type Op =
  | { t: "add"; order: Order }
  | { t: "update"; order: Order }
  | { t: "delete"; id: string }
  | { t: "done"; id: string; v: boolean }
  | { t: "closed"; date: string; v: boolean }
  | { t: "products"; products: Product[] }
  | { t: "status"; id: string; s: "confirm" | "ready" | "decline" | "unready"; reason?: string }
  | { t: "reply"; thread: string; text: string }
  | { t: "seen"; thread: string }
  | { t: "day"; date: string; info: DayInfo };

export type Result = { state: State } | { error: string };

const dayName = (date: string) => parse(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

/** Add a message from the bakery to the order's conversation, so the customer sees it. */
export function bakeryNote(s: State, orderId: string, text: string, at = Date.now()): State {
  const threads = { ...(s.threads ?? {}) };
  const th = Object.values(threads).find((t) => t.orderId === orderId);
  if (!th) return s;
  threads[th.id] = { ...th, msgs: [...th.msgs, { id: uid(), from: "bakery", text, at }], staffSeen: th.msgs.length + 1, at };
  return { ...s, threads };
}

export function applyOp(s: State, op: Op): Result {
  switch (op.t) {
    case "add": {
      if (s.orders.some((o) => o.id === op.order.id)) return { state: s }; // sent twice, keep one
      if (op.order.source === "online") {
        if (s.closed[op.order.date]) return { error: "Sorry, that day just closed for online orders. Please pick another day." };
        const idx = sizeIndex(s.products);
        const booked = s.orders.filter((o) => o.date === op.order.date && isLive(o)).reduce((n, o) => n + orderPieces(o, idx), 0);
        if (booked + orderPieces(op.order, idx) > DAILY_LIMIT) return { error: "Sorry, that day just filled up. Please pick another day." };
        const off = op.order.items.find((i) => !s.products.some((p) => p.sizes.some((z) => z.on && z.code === i.code)));
        if (off) return { error: "One of your boxes just sold out. Please check your order." };
      }
      return { state: { ...s, orders: [...s.orders, op.order] } };
    }
    case "update": {
      const cur = s.orders.find((o) => o.id === op.order.id);
      if (!cur) return { error: "That order was deleted on another device." };
      // Keep the customer's private key and history, whatever the form sends.
      const next = { ...op.order, token: cur.token, cancelled: cur.cancelled };
      return { state: { ...s, orders: s.orders.map((o) => (o.id === next.id ? next : o)) } };
    }
    case "delete":
      return { state: { ...s, orders: s.orders.filter((o) => o.id !== op.id) } };
    case "done": {
      const done = { ...s.done };
      if (op.v) done[op.id] = true; else delete done[op.id];
      return { state: { ...s, done } };
    }
    case "closed": {
      const closed = { ...s.closed };
      if (op.v) closed[op.date] = true; else delete closed[op.date];
      return { state: { ...s, closed } };
    }
    case "products":
      return { state: { ...s, products: op.products } };
    case "status": {
      const o = s.orders.find((x) => x.id === op.id);
      if (!o) return { error: "That order is no longer here." };
      if (o.cancelled) return { error: "The customer cancelled this order." };
      let next: Order = o, note = "";
      if (op.s === "confirm") {
        next = { ...o, pending: false };
        delete next.declined;
        note = `Your order is confirmed. See you ${dayName(o.date)} at ${fmtTime(o.time)}.`;
      } else if (op.s === "ready") {
        next = { ...o, pending: false, ready: true };
        note = `Your order is ready. It is boxed and waiting for you at ${fmtTime(o.time)}.`;
      } else if (op.s === "unready") {
        next = { ...o, ready: false };
      } else {
        next = { ...o, pending: false, declined: (op.reason || "We cannot take this order.").slice(0, 300) };
        note = `Sorry, we can't take this order. ${next.declined}`;
      }
      let out: State = { ...s, orders: s.orders.map((x) => (x.id === o.id ? next : x)) };
      if (note) out = bakeryNote(out, o.id, note);
      return { state: out };
    }
    case "reply": {
      const th = s.threads?.[op.thread];
      const text = op.text.trim().slice(0, 1000);
      if (!th) return { error: "That conversation is gone." };
      if (!text) return { error: "Write a message first." };
      const t: Thread = { ...th, msgs: [...th.msgs, { id: uid(), from: "bakery", text, at: Date.now() }], at: Date.now() };
      t.staffSeen = t.msgs.length;
      return { state: { ...s, threads: { ...s.threads, [t.id]: t } } };
    }
    case "seen": {
      const th = s.threads?.[op.thread];
      if (!th || th.staffSeen === th.msgs.length) return { state: s };
      return { state: { ...s, threads: { ...s.threads, [th.id]: { ...th, staffSeen: th.msgs.length } } } };
    }
    case "day": {
      const days = { ...(s.days ?? {}) };
      const info: DayInfo = { place: op.info.place?.slice(0, 120) || undefined, from: op.info.from, to: op.info.to };
      if (info.from !== undefined && info.to !== undefined && info.from >= info.to) return { error: "The pickup window must end after it starts." };
      days[op.date] = info;
      return { state: { ...s, days } };
    }
  }
}

// A light shape check for anything arriving from the internet.
export function isOp(x: unknown): x is Op {
  if (!x || typeof x !== "object") return false;
  const o = x as { t?: unknown; order?: unknown; id?: unknown; v?: unknown; date?: unknown; products?: unknown; s?: unknown; thread?: unknown; text?: unknown; info?: unknown };
  const isOrder = (v: unknown) => !!v && typeof v === "object" && typeof (v as Order).id === "string" && typeof (v as Order).date === "string" && Array.isArray((v as Order).items) && (v as Order).items.length <= 50;
  switch (o.t) {
    case "add": case "update": return isOrder(o.order);
    case "delete": return typeof o.id === "string";
    case "done": return typeof o.id === "string" && typeof o.v === "boolean";
    case "closed": return typeof o.date === "string" && typeof o.v === "boolean";
    case "products": return Array.isArray(o.products) && o.products.length <= 60;
    case "status": return typeof o.id === "string" && ["confirm", "ready", "decline", "unready"].includes(o.s as string);
    case "reply": return typeof o.thread === "string" && typeof o.text === "string";
    case "seen": return typeof o.thread === "string";
    case "day": return typeof o.date === "string" && !!o.info && typeof o.info === "object";
    default: return false;
  }
}
