import { useSyncExternalStore } from "react";
import { applyOp, type Op } from "./ops";

export type Size = { id: string; pieces: number; code: string; price: number; on: boolean };
export type Product = { id: string; name: string; photo?: string | undefined; sizes: Size[] };
export type Item = { code: string; qty: number };
export type Order = {
  id: string;
  date: string; // yyyy-mm-dd
  time: number; // minutes from midnight
  name: string;
  phone: string;
  items: Item[];
  note: string;
  source: "online" | "by hand";
  text: boolean;
  pending?: boolean; // online order the shop has not confirmed yet
  placed?: number; // when it was placed, ms
};
export type State = { products: Product[]; orders: Order[]; done: Record<string, boolean>; closed: Record<string, boolean> };

export const DAILY_LIMIT = 400;
const KEY = "lunar-orders-v3";

export const iso = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
export const parse = (s: string) => new Date(s + "T12:00:00");
export function mondayOf(offset = 0, from = new Date()) {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return d;
}
export function weekDays(offset: number) {
  const m = mondayOf(offset);
  return Array.from({ length: 6 }, (_, i) => { const d = new Date(m); d.setDate(m.getDate() + i); return d; });
}
export const fmtTime = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60, h12 = h % 12 || 12;
  return `${h12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h < 12 ? "am" : "pm"}`;
};
export const TIMES = Array.from({ length: 21 }, (_, i) => 8 * 60 + i * 30);
export const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: n % 1 ? 2 : 0, minimumFractionDigits: n % 1 ? 2 : 0 });
export const uid = () => Math.random().toString(36).slice(2, 10);

const sizes = (p: string, list: [number, number][]): Size[] => list.map(([pieces, price]) => ({ id: uid(), pieces, code: `${p}x${pieces}`, price, on: true }));
const seedProducts = (): Product[] => [
  { id: uid(), name: "Pastel de Nata", photo: "/images/hero-natas.jpg", sizes: sizes("n", [[6, 30], [12, 56], [24, 105]]) },
  { id: uid(), name: "Kouign-Amann", photo: "/images/kouign-tray.jpg", sizes: sizes("k", [[6, 36], [12, 68], [24, 128]]) },
  { id: uid(), name: "Kouign with Gold", photo: "/images/kouign-gold.jpg", sizes: sizes("g", [[6, 42], [12, 80], [24, 150]]) },
  { id: uid(), name: "Natas & Kouigns", photo: "/images/natas-kouigns.jpg", sizes: sizes("m", [[12, 62]]) },
];

function seedOrders(): Order[] {
  const raw: [number, number, number, string, string, [string, number][], string, "online" | "by hand"][] = [
    // week offset, weekday 0=Mon, minutes, name, phone, items, note, source
    [-1, 0, 630, "Hillary", "(415) 552-1180", [["kx24", 2]], "", "by hand"],
    [-1, 1, 720, "Jimmy", "(415) 229-9053", [["nx12", 1]], "Extra cinnamon", "by hand"],
    [-1, 2, 840, "Grace", "(415) 871-3321", [["gx12", 1]], "Gift box", "online"],
    [-1, 3, 900, "Jimmy", "(415) 229-9053", [["nx24", 1]], "", "by hand"],
    [-1, 4, 660, "Owen", "(415) 313-4410", [["mx12", 2]], "", "by hand"],
    [-1, 5, 600, "Jimmy", "(415) 229-9053", [["kx12", 1], ["nx6", 1]], "", "by hand"],
    [0, 0, 630, "Maria", "(415) 229-9053", [["nx12", 1]], "", "online"],
    [0, 0, 780, "James", "(415) 943-2176", [["kx12", 1]], "Gift box", "online"],
    [0, 1, 690, "James", "(415) 229-9053", [["nx6", 1]], "", "by hand"],
    [0, 1, 750, "Tiffany", "(415) 237-9801", [["kx12", 1], ["nx6", 1]], "Warm please", "by hand"],
    [0, 1, 900, "Veronica", "(415) 237-5631", [["nx6", 1]], "Less sweet", "by hand"],
    [0, 2, 690, "Brian", "(415) 878-1231", [["mx12", 1]], "Gift box for my wife!", "by hand"],
    [0, 2, 720, "Tiffany", "(415) 289-1234", [["kx6", 1]], "Less sweet", "by hand"],
    [0, 3, 960, "Laura", "(415) 639-1234", [["kx24", 1], ["gx24", 2]], "Gold leaf on the kouigns, plain natas for the kids", "by hand"],
    [0, 3, 1020, "Gary", "(206) 474-6902", [["nx24", 1]], "Box them in sixes please!", "by hand"],
    [0, 3, 1050, "Tracy", "(415) 290-7812", [["nx12", 1], ["kx24", 1]], "", "by hand"],
    [0, 4, 780, "Kevin", "(415) 229-9053", [["nx12", 1]], "", "online"],
    [0, 4, 810, "Jessica", "(415) 283-7819", [["mx12", 1]], "Less sweet", "by hand"],
    [0, 4, 930, "Jimmy", "(415) 229-9053", [["kx12", 1]], "Less sweet", "by hand"],
    [0, 5, 720, "Sarah", "(415) 273-9123", [["gx6", 1]], "I want an extra bag", "by hand"],
  ];
  return raw.map(([w, d, time, name, phone, items, note, source]) => {
    const day = mondayOf(w); day.setDate(day.getDate() + d);
    return { id: uid(), date: iso(day), time, name, phone, items: items.map(([code, qty]) => ({ code, qty })), note, source, text: false };
  });
}

export function seed(): State {
  const orders = seedOrders();
  const done: Record<string, boolean> = {};
  const today = iso(new Date());
  orders.forEach((o, i) => { if (o.date < today && i % 2 === 0) done[o.id] = true; });
  return { products: seedProducts(), orders, done, closed: {} };
}

/*
 * Sync.
 * Live mode: the site has a database (DATABASE_URL on Vercel). Every device reads and
 * writes the same shop data through /api/lunar, and checks for news every few seconds.
 * Local mode: no database yet. Data lives in this browser only, and tabs in the same
 * browser still update each other instantly. The site picks the mode by itself.
 * Orders that arrive from elsewhere are announced through onArrive so the board can animate them.
 */
export type SyncStatus = "loading" | "live" | "local" | "offline";
let state: State | null = null;
let version = 0;
let status: SyncStatus = "loading";
const listeners = new Set<() => void>();
const statusListeners = new Set<() => void>();
const freshListeners = new Set<(ids: string[]) => void>();
export const onArrive = (fn: (ids: string[]) => void) => { freshListeners.add(fn); return () => { freshListeners.delete(fn); }; };

function read(): State | null {
  try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as State) : null; } catch { return null; }
}
function cache() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ } }
function load(): State {
  if (state) return state;
  if (typeof window === "undefined") return (state = seed());
  state = read() ?? seed();
  cache();
  return state;
}
export const getState = () => load();
const emit = () => listeners.forEach((l) => l());
function setStatus(s: SyncStatus) { if (s !== status) { status = s; statusListeners.forEach((l) => l()); } }

// Swap in a newer copy and announce any orders we had not seen.
function replace(next: State) {
  const before = new Set(load().orders.map((o) => o.id));
  state = next;
  cache();
  emit();
  const added = next.orders.filter((o) => !before.has(o.id)).map((o) => o.id);
  if (added.length) freshListeners.forEach((f) => f(added));
}

let channel: BroadcastChannel | null = null;
async function fetchState(first = false) {
  try {
    const r = await fetch(`/api/lunar${first ? "" : `?v=${version}`}`, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const d = (await r.json()) as { enabled: boolean; same?: boolean; state?: State; version?: number };
    if (!d.enabled) { setStatus("local"); return; }
    if (!d.same && d.state) { version = d.version ?? version; first ? ((state = d.state), cache(), emit()) : replace(d.state); }
    setStatus("live");
  } catch {
    // No server answer (for example a plain static preview). Before we have ever been live, treat it as local mode.
    setStatus(status === "live" || status === "offline" ? "offline" : "local");
  }
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === KEY && status !== "live") { const n = read(); if (n) replace(n); } });
  try { channel = new BroadcastChannel("lunar-orders"); channel.onmessage = () => { if (status === "live") void fetchState(); else { const n = read(); if (n) replace(n); } }; } catch { channel = null; }
  void fetchState(true);
  setInterval(() => { if ((status === "live" || status === "offline") && document.visibilityState === "visible") void fetchState(); }, 3000);
  // Coming back to a tab always re-checks for news, in case a message from another tab was missed.
  const recheck = () => {
    if (status === "live" || status === "offline") void fetchState();
    else if (status === "local") { const n = read(); if (n && JSON.stringify(n) !== JSON.stringify(state)) replace(n); }
  };
  window.addEventListener("focus", recheck);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") recheck(); });
}

let queue: Promise<unknown> = Promise.resolve();
/** Make a change. Shows on screen straight away, then is saved for every device. */
export function dispatch(op: Op): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = applyOp(load(), op);
  if ("error" in res) return Promise.resolve({ ok: false, error: res.error });
  state = res.state;
  cache();
  emit();
  if (status !== "live" && status !== "offline") { channel?.postMessage(1); return Promise.resolve({ ok: true }); }
  // Live: send changes one after another so they arrive in the order they were made.
  const send = async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch("/api/lunar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ op }) });
        const d = (await r.json()) as { state?: State; version?: number; error?: string };
        if (d.state) { version = d.version ?? version; state = d.state; cache(); emit(); } else void fetchState(); // put the screen back to what is really saved
        setStatus("live");
        channel?.postMessage(1);
        return d.error ? { ok: false, error: d.error } : { ok: true };
      } catch {
        setStatus("offline");
        await new Promise((ok) => setTimeout(ok, 800 * (attempt + 1)));
      }
    }
    void fetchState();
    return { ok: false, error: "No connection. Your change was not saved, please try again." };
  };
  const p = queue.then(send, send);
  queue = p;
  return p;
}

const serverSnap = seed();
export function useStore() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, load, () => serverSnap);
}
export function useSyncStatus() {
  return useSyncExternalStore((l) => { statusListeners.add(l); return () => statusListeners.delete(l); }, () => status, () => "loading" as SyncStatus);
}

export function dayPiecesOf(s: State, date: string) {
  const idx = sizeIndex(s.products);
  return s.orders.filter((o) => o.date === date).reduce((n, o) => n + orderPieces(o, idx), 0);
}
export const reduceMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function sizeIndex(products: Product[]) {
  const m = new Map<string, { product: Product; size: Size }>();
  products.forEach((p) => p.sizes.forEach((s) => m.set(s.code, { product: p, size: s })));
  return m;
}
export function orderPieces(o: Order, idx: ReturnType<typeof sizeIndex>) {
  return o.items.reduce((s, i) => s + i.qty * (idx.get(i.code)?.size.pieces ?? 0), 0);
}
export function orderBooked(o: Order, idx: ReturnType<typeof sizeIndex>) {
  return o.items.reduce((s, i) => s + i.qty * (idx.get(i.code)?.size.price ?? 0), 0);
}
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
}
