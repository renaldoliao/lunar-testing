import { useSyncExternalStore } from "react";
import { applyOp, type Op } from "./ops";
import { applyCustomer, mineView, publicView, type COp } from "./shop";

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
  pending?: boolean | undefined; // online order the shop has not confirmed yet
  placed?: number | undefined; // when it was placed, ms
  token?: string | undefined; // the customer's private key for following this order
  ready?: boolean | undefined; // baked and waiting on the shelf
  declined?: string | undefined; // the shop could not take it, with the reason
  cancelled?: boolean | undefined; // the customer cancelled it
};
export type Msg = { id: string; from: "customer" | "bakery"; text: string; at: number };
export type Thread = { id: string; token: string; name: string; phone?: string | undefined; orderId?: string | undefined; msgs: Msg[]; staffSeen: number; custSeen: number; at: number };
export type DayInfo = { place?: string | undefined; from?: number | undefined; to?: number | undefined };
export type State = { products: Product[]; orders: Order[]; done: Record<string, boolean>; closed: Record<string, boolean>; days?: Record<string, DayInfo>; threads?: Record<string, Thread> };
/** What anyone may see: the menu, open days, pop-up places and how full each day is. Never names or phone numbers. */
export type PublicView = { products: Product[]; closed: Record<string, boolean>; days: Record<string, DayInfo>; load: Record<string, number> };
/** What one customer may see: only their own orders and conversations. */
export type MineOrder = Order & { picked: boolean };
export type Mine = { orders: MineOrder[]; threads: Thread[] };

export type OrderStatus = "pending" | "confirmed" | "ready" | "picked" | "declined" | "cancelled";
export const statusOf = (o: Order, done: Record<string, boolean>): OrderStatus =>
  o.cancelled ? "cancelled" : o.declined ? "declined" : o.pending ? "pending" : done[o.id] ? "picked" : o.ready ? "ready" : "confirmed";
/** Status of a customer's own order, as they see it. */
export const custStatus = (o: MineOrder): OrderStatus => statusOf(o, o.picked ? { [o.id]: true } : {});
/** Cancelled and declined orders no longer use up the day's oven space. */
export const isLive = (o: Order) => !o.cancelled && !o.declined;
export const DEFAULT_PLACE = "2948 Folsom St, San Francisco";
export const OPEN_FROM = 8 * 60, OPEN_TO = 18 * 60;
export const dayHours = (d: DayInfo | undefined) => ({ from: d?.from ?? OPEN_FROM, to: d?.to ?? OPEN_TO, place: d?.place || DEFAULT_PLACE });

export const DAILY_LIMIT = 400;
const KEY = "lunar-orders-v4";

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
export const secret = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);

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
  return { products: seedProducts(), orders, done, closed: {}, days: {}, threads: {} };
}

/*
 * Sync, both ways.
 * Live mode (a database is connected on Vercel): the dashboard reads and writes the whole shop
 * through /api/lunar with the staff password. Customers talk to /api/shop, which only ever
 * returns the menu, open days, and their own orders and messages. Every screen checks for news
 * every few seconds, so a confirm, a reply or a new order shows up on the other side by itself.
 * Local mode (no database yet): everything lives in this browser, and tabs update each other.
 */
export type SyncStatus = "loading" | "live" | "local" | "offline";
type Res = { ok: true } | { ok: false; error: string };
let state: State | null = null; // whole shop: local mode, or the dashboard in live mode
let version = 0;
let pub: PublicView | null = null; // live mode, customer pages
let mine: Mine = { orders: [], threads: [] }; // live mode, customer pages
let status: SyncStatus = "loading";
let staffOn = false, custOn = false, staffDenied = false, staffLoaded = false;
const listeners = new Set<() => void>();
const statusListeners = new Set<() => void>();
const freshListeners = new Set<(ids: string[]) => void>();
const msgListeners = new Set<(n: number) => void>();
export const onArrive = (fn: (ids: string[]) => void) => { freshListeners.add(fn); return () => { freshListeners.delete(fn); }; };
/** Called with how many new customer messages just came in (dashboard side). */
export const onMessages = (fn: (n: number) => void) => { msgListeners.add(fn); return () => { msgListeners.delete(fn); }; };

const isBrowser = typeof window !== "undefined";
function read(): State | null {
  try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as State) : null; } catch { return null; }
}
function cache() { if (status !== "live" && status !== "offline") try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ } }
function load(): State {
  if (state) return state;
  if (!isBrowser) return (state = seed());
  state = read() ?? seed();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  return state;
}
export const getState = () => load();
const emit = () => { derived = null; listeners.forEach((l) => l()); };
function setStatus(s: SyncStatus) { if (s !== status) { status = s; emit(); statusListeners.forEach((l) => l()); } }

const inbound = (s: State) => Object.values(s.threads ?? {}).reduce((n, t) => n + t.msgs.filter((m) => m.from === "customer").length, 0);
// Swap in a newer copy and announce new orders and new messages.
function replace(next: State) {
  const prev = state;
  const before = new Set((prev ?? next).orders.map((o) => o.id));
  const msgsBefore = prev ? inbound(prev) : inbound(next);
  state = next;
  cache();
  emit();
  const added = next.orders.filter((o) => !before.has(o.id)).map((o) => o.id);
  if (added.length) freshListeners.forEach((f) => f(added));
  const more = inbound(next) - msgsBefore;
  if (more > 0) msgListeners.forEach((f) => f(more));
}

/* ---------- the customer's own key ring, kept on their device ---------- */
type Key = { id: string; token: string };
export type Me = { orders: Key[]; threads: Key[]; name?: string; phone?: string };
const ME = "lunar-me";
export function me(): Me {
  if (!isBrowser) return { orders: [], threads: [] };
  try { return { orders: [], threads: [], ...JSON.parse(localStorage.getItem(ME) || "{}") }; } catch { return { orders: [], threads: [] }; }
}
function saveMe(m: Me) { try { localStorage.setItem(ME, JSON.stringify(m)); } catch { /* ignore */ } emit(); }
export function remember(kind: "orders" | "threads", k: Key, contact?: { name?: string | undefined; phone?: string | undefined }) {
  const m = me();
  if (!m[kind].some((x) => x.id === k.id)) m[kind] = [...m[kind], k].slice(-30);
  if (contact?.name) m.name = contact.name;
  if (contact?.phone) m.phone = contact.phone;
  saveMe(m);
}

/* ---------- talking to the server ---------- */
let channel: BroadcastChannel | null = null;
const staffKey = () => { try { return sessionStorage.getItem("lunar-key") || localStorage.getItem("lunar-key") || ""; } catch { return ""; } };
export function setStaffKey(k: string) { try { localStorage.setItem("lunar-key", k); } catch { /* ignore */ } staffDenied = false; }
export const isStaffDenied = () => staffDenied;

async function probe() {
  try {
    const r = await fetch("/api/shop", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const d = (await r.json()) as { enabled: boolean; view?: PublicView; version?: number };
    if (!d.enabled) return setStatus("local");
    if (d.view) pub = d.view;
    setStatus("live");
    await tick(true);
  } catch {
    setStatus("local"); // no server at all, for example a static preview
  }
}
async function fetchStaff(force = false) {
  const r = await fetch(`/api/lunar${force || !version ? "" : `?v=${version}`}`, { cache: "no-store", headers: { "x-lunar-key": staffKey() } });
  if (r.status === 401) { staffDenied = true; emit(); return; }
  if (!r.ok) throw new Error(String(r.status));
  const d = (await r.json()) as { same?: boolean; state?: State; version?: number };
  if (!d.same && d.state) { version = d.version ?? version; if (!staffLoaded || force) { staffLoaded = true; state = d.state; emit(); } else replace(d.state); }
}
let pubTick = 0;
async function fetchCustomer(withPublic: boolean) {
  const m = me();
  if (withPublic) {
    const r = await fetch("/api/shop", { cache: "no-store" });
    const d = (await r.json()) as { view?: PublicView };
    if (d.view) pub = d.view;
  }
  if (m.orders.length || m.threads.length) {
    const r = await fetch("/api/shop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mine: { orders: m.orders, threads: m.threads } }) });
    const d = (await r.json()) as Partial<Mine>;
    mine = { orders: d.orders ?? [], threads: d.threads ?? [] };
  }
  emit();
}
let busy = false;
async function tick(force = false) {
  if (busy || (status !== "live" && status !== "offline")) return;
  busy = true;
  try {
    if (staffOn) await fetchStaff(force);
    if (custOn) await fetchCustomer(force || pubTick++ % 4 === 0);
    if (status === "offline") setStatus("live");
  } catch {
    setStatus("offline");
  } finally { busy = false; }
}
if (isBrowser) {
  window.addEventListener("storage", (e) => { if ((e.key === KEY || e.key === ME) && status === "local") { const n = read(); if (n) replace(n); else emit(); } });
  try { channel = new BroadcastChannel("lunar-orders"); channel.onmessage = () => { if (status === "local") { const n = read(); if (n) replace(n); } else void tick(); }; } catch { channel = null; }
  void probe();
  setInterval(() => { if (document.visibilityState === "visible") void tick(); }, 2000);
  const recheck = () => {
    if (status === "local") { const n = read(); if (n && JSON.stringify(n) !== JSON.stringify(state)) replace(n); }
    else void tick();
  };
  window.addEventListener("focus", recheck);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") recheck(); });
}
/** Fetch a customer's own orders and messages straight away (after they open a link). */
export function refreshCustomer() { if (isBrowser) setTimeout(() => void tick(true), 0); }
/** The dashboard calls this: keep the whole shop in sync while it is open. */
export function useStaffSync() {
  if (isBrowser && !staffOn) { staffOn = true; void tick(true); }
}
/** Customer pages call this: keep the menu, open days and their own orders in sync. */
export function useCustomerSync() {
  if (isBrowser && !custOn) { custOn = true; void tick(true); }
}
export async function checkStaffKey(k: string): Promise<boolean> {
  if (status !== "live" && status !== "offline") return k === "lunar123";
  const r = await fetch("/api/lunar?v=-1", { headers: { "x-lunar-key": k } }).catch(() => null);
  return !!r && r.ok;
}

let queue: Promise<unknown> = Promise.resolve();
const serial = (fn: () => Promise<Res>) => { const p = queue.then(fn, fn); queue = p; return p; };

/** A change made by the bakery. Shows at once, then is saved for every device. */
export function dispatch(op: Op): Promise<Res> {
  const res = applyOp(load(), op);
  if ("error" in res) return Promise.resolve({ ok: false, error: res.error });
  state = res.state;
  cache();
  emit();
  if (status === "local" || status === "loading") { channel?.postMessage(1); return Promise.resolve({ ok: true }); }
  return serial(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch("/api/lunar", { method: "POST", headers: { "content-type": "application/json", "x-lunar-key": staffKey() }, body: JSON.stringify({ op }) });
        if (r.status === 401) { staffDenied = true; emit(); return { ok: false, error: "Please sign in again." }; }
        const d = (await r.json()) as { state?: State; version?: number; error?: string };
        if (d.state) { version = d.version ?? version; state = d.state; emit(); } else void tick(true);
        setStatus("live");
        return d.error ? { ok: false, error: d.error } : { ok: true };
      } catch {
        setStatus("offline");
        await new Promise((ok) => setTimeout(ok, 800 * (attempt + 1)));
      }
    }
    void tick(true);
    return { ok: false, error: "No connection. Your change was not saved, please try again." };
  });
}

/** A change made by a customer: placing an order, sending a message, cancelling. */
export function custOp(op: COp): Promise<Res> {
  if (status === "local" || status === "loading") {
    const res = applyCustomer(load(), op, Date.now());
    if ("error" in res) return Promise.resolve({ ok: false, error: res.error });
    state = res.state;
    cache();
    emit();
    channel?.postMessage(1);
    return Promise.resolve({ ok: true });
  }
  return serial(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch("/api/shop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cop: op }) });
        const d = (await r.json()) as { ok?: boolean; error?: string; view?: PublicView };
        if (d.view) pub = d.view;
        await fetchCustomer(false);
        return d.error ? { ok: false, error: d.error } : { ok: true };
      } catch {
        await new Promise((ok) => setTimeout(ok, 800 * (attempt + 1)));
      }
    }
    return { ok: false, error: "No connection. Please check your internet and try again." };
  });
}

/* ---------- hooks ---------- */
const sub = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const serverSnap = seed();
export function useStore() {
  return useSyncExternalStore(sub, load, () => serverSnap);
}
export function useSyncStatus() {
  return useSyncExternalStore((l) => { statusListeners.add(l); return () => statusListeners.delete(l); }, () => status, () => "loading" as SyncStatus);
}
let derived: { pub: PublicView; mine: Mine } | null = null;
function views() {
  if (derived) return derived;
  if (status === "live" || status === "offline") derived = { pub: pub ?? publicView(seed()), mine };
  else { const s = load(); derived = { pub: publicView(s), mine: mineView(s, me()) }; }
  return derived;
}
const serverViews = { pub: publicView(serverSnap), mine: { orders: [], threads: [] } as Mine };
export function usePublic(): PublicView {
  return useSyncExternalStore(sub, () => views().pub, () => serverViews.pub);
}
export function useMine(): Mine {
  return useSyncExternalStore(sub, () => views().mine, () => serverViews.mine);
}
/** True once the dashboard has the real, current shop data to show. */
export function useStaffReady() {
  return useSyncExternalStore(sub, () => status === "local" || staffLoaded || staffDenied, () => false);
}
export function useStaffDenied() {
  return useSyncExternalStore(sub, () => staffDenied, () => false);
}

export function dayPiecesOf(s: State, date: string) {
  const idx = sizeIndex(s.products);
  return s.orders.filter((o) => o.date === date && isLive(o)).reduce((n, o) => n + orderPieces(o, idx), 0);
}
export const reduceMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function sizeIndex(products: Product[]) {
  const m = new Map<string, { product: Product; size: Size }>();
  products.forEach((p) => p.sizes.forEach((s) => m.set(s.code, { product: p, size: s })));
  return m;
}
/** "Pastel de Nata · 12 pc" instead of a shop code like "nx12". */
export function itemLabel(code: string, idx: ReturnType<typeof sizeIndex>) {
  const m = idx.get(code);
  return m ? `${m.product.name} · ${m.size.pieces} pc` : code;
}
export const itemsText = (o: Order, idx: ReturnType<typeof sizeIndex>, sep = "; ") => o.items.map((i) => `${i.qty} × ${itemLabel(i.code, idx)}`).join(sep);
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
