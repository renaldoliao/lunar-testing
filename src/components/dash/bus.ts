// A tiny message line between parts of the dashboard, for example "open this order"
// from the Messages inbox, which lives in a different tab from the week board.
type Fn = (id: string) => void;
const fns = new Set<Fn>();
let pending: string | null = null;
export const openOrder = (id: string) => { if (fns.size) fns.forEach((f) => f(id)); else pending = id; };
export const onOpenOrder = (f: Fn) => { fns.add(f); if (pending) { const p = pending; pending = null; setTimeout(() => f(p), 50); } return () => { fns.delete(f); }; };
