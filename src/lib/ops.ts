import { DAILY_LIMIT, orderPieces, sizeIndex, type Order, type Product, type State } from "./store";

/*
 * Every change to the shop's data is one of these small "operations".
 * The same function applies them in the browser (so the screen updates at once)
 * and on the server (so every device ends up with the same result, in the same order).
 */
export type Op =
  | { t: "add"; order: Order }
  | { t: "update"; order: Order }
  | { t: "delete"; id: string }
  | { t: "done"; id: string; v: boolean }
  | { t: "closed"; date: string; v: boolean }
  | { t: "products"; products: Product[] };

export type Result = { state: State } | { error: string };

export function applyOp(s: State, op: Op): Result {
  switch (op.t) {
    case "add": {
      if (s.orders.some((o) => o.id === op.order.id)) return { state: s }; // sent twice, keep one
      if (op.order.source === "online") {
        if (s.closed[op.order.date]) return { error: "Sorry, that day just closed for online orders. Please pick another day." };
        const idx = sizeIndex(s.products);
        const booked = s.orders.filter((o) => o.date === op.order.date).reduce((n, o) => n + orderPieces(o, idx), 0);
        if (booked + orderPieces(op.order, idx) > DAILY_LIMIT) return { error: "Sorry, that day just filled up. Please pick another day." };
        const off = op.order.items.find((i) => !s.products.some((p) => p.sizes.some((z) => z.on && z.code === i.code)));
        if (off) return { error: "One of your boxes just sold out. Please check your order." };
      }
      return { state: { ...s, orders: [...s.orders, op.order] } };
    }
    case "update":
      if (!s.orders.some((o) => o.id === op.order.id)) return { error: "That order was deleted on another device." };
      return { state: { ...s, orders: s.orders.map((o) => (o.id === op.order.id ? op.order : o)) } };
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
  }
}

// A light shape check for anything arriving from the internet.
export function isOp(x: unknown): x is Op {
  if (!x || typeof x !== "object") return false;
  const o = x as { t?: unknown; order?: unknown; id?: unknown; v?: unknown; date?: unknown; products?: unknown };
  const isOrder = (v: unknown) => !!v && typeof v === "object" && typeof (v as Order).id === "string" && typeof (v as Order).date === "string" && Array.isArray((v as Order).items) && (v as Order).items.length <= 50;
  switch (o.t) {
    case "add": case "update": return isOrder(o.order);
    case "delete": return typeof o.id === "string";
    case "done": return typeof o.id === "string" && typeof o.v === "boolean";
    case "closed": return typeof o.date === "string" && typeof o.v === "boolean";
    case "products": return Array.isArray(o.products) && o.products.length <= 60;
    default: return false;
  }
}
