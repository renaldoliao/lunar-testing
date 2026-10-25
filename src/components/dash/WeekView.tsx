import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DAILY_LIMIT, downloadCsv, fmtTime, iso, mondayOf, money, orderBooked, orderPieces, parse, dispatch, sizeIndex, useStore, weekDays, type Order } from "@/lib/store";
import { Drawer } from "./Drawer";
import { OrderForm } from "./OrderForm";
import { toast } from "./Toast";

type Panel = { kind: "write"; date: string; order?: Order | undefined } | { kind: "bake"; date: string } | { kind: "numbers" } | null;
const WEEK = 7 * 864e5;
const weekOf = (date: string) => Math.round((mondayOf(0, parse(date)).getTime() - mondayOf(0).getTime()) / WEEK);
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };

export function WeekView({ numbersOpen, setNumbersOpen }: { numbersOpen: boolean; setNumbersOpen: (v: boolean) => void }) {
  const s = useStore();
  const [week, setWeek] = useState(0);
  const [dir, setDir] = useState<"" | "from-left" | "from-right">("");
  const [panel, setPanel] = useState<Panel>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set()); // ticked during this visit, so the strike animates
  const [just, setJust] = useState<Set<string>>(new Set()); // new on the board, so it slides in
  const [clock, setClock] = useState(nowMin());
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => { const t = setInterval(() => setClock(nowMin()), 30000); return () => clearInterval(t); }, []);
  // On a phone the days stack, so jump straight to today, like Baklava.
  useEffect(() => {
    if (window.innerWidth > 700) return;
    const t = setTimeout(() => { const el = document.querySelector("[data-today]"); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 8, behavior: "smooth" }); }, 250);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const ids = new Set(s.orders.map((o) => o.id));
    if (seen.current) {
      const added = [...ids].filter((i) => !seen.current!.has(i));
      if (added.length) { setJust(new Set(added)); setTimeout(() => setJust(new Set()), 1000); }
    }
    seen.current = ids;
  }, [s.orders]);

  const idx = sizeIndex(s.products);
  const days = weekDays(week);
  const first = days[0]!, last = days[5]!;
  const today = iso(new Date());
  const short = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const weekOrders = s.orders.filter((o) => o.date >= iso(first) && o.date <= iso(last));
  const dayOrders = (k: string) => s.orders.filter((o) => o.date === k).sort((a, b) => (a.pending ? 0 : 1) - (b.pending ? 0 : 1) || a.time - b.time);
  const dayPieces = (k: string) => dayOrders(k).reduce((n, o) => n + orderPieces(o, idx), 0);
  const pending = s.orders.filter((o) => o.pending).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  // Same as Baklava: one tap asks "picked up?" in a small box, so nothing is crossed out by accident.
  const [pop, setPop] = useState<Order | null>(null);
  // Highlighter marks on the time, name or note. Personal reminders, kept on this computer only.
  const [marks, setMarks] = useState<Record<string, true>>({});
  useEffect(() => { try { setMarks(JSON.parse(localStorage.getItem("lunar-marks") || "{}")); } catch { /* none yet */ } }, []);
  const mark = (key: string) => setMarks((m) => {
    const n = { ...m };
    if (n[key]) delete n[key]; else n[key] = true;
    try { localStorage.setItem("lunar-marks", JSON.stringify(n)); } catch { /* ignore */ }
    return n;
  });
  const tap = (e: React.MouseEvent, o: Order) => {
    const t = e.target as HTMLElement;
    if (t.closest("button")) return;
    const m = t.closest<HTMLElement>("[data-mark]");
    if (m) return mark(o.id + m.dataset["mark"]);
    if (o.pending) return open(o);
    setPop(o);
  };
  const confirmNew = (o: Order) => void dispatch({ t: "update", order: { ...o, pending: false } }).then((r) => toast(r.ok ? `Confirmed ${o.name}. ${o.text ? "Text" : "Call"} them on ${o.phone || "their number"}` : r.error));
  const toggle = (id: string, v: boolean) => {
    setPicked((p) => new Set(p).add(id));
    void dispatch({ t: "done", id, v }).then((r) => { if (!r.ok) toast(r.error); });
  };
  const go = (n: number) => { if (n === week) return; setDir(n > week ? "from-right" : "from-left"); setPicked(new Set()); setWeek(n); };
  const open = (o: Order) => { go(weekOf(o.date)); setPanel({ kind: "write", date: o.date, order: o }); };
  const sub = week === 0 ? "This week" : week === -1 ? "Last week" : week === 1 ? "Next week" : `${Math.abs(week)} weeks ${week < 0 ? "ago" : "ahead"}`;
  const active: Panel = numbersOpen ? { kind: "numbers" } : panel;
  const close = () => { setPanel(null); setNumbersOpen(false); };

  const exportCsv = () =>
    downloadCsv(`lunar-orders-${iso(first)}.csv`, [
      ["Date", "Time", "Name", "Phone", "Items", "Pieces", "Booked", "Note", "Source", "Picked up"],
      ...weekOrders.sort((a, b) => a.date.localeCompare(b.date) || a.time - b.time).map((o) => [o.date, fmtTime(o.time), o.name, o.phone, o.items.map((i) => `${i.qty} x ${i.code}`).join("; "), orderPieces(o, idx), orderBooked(o, idx), o.note, o.source, s.done[o.id] ? "yes" : "no"]),
    ]);

  return (
    <>
      {pending.length > 0 && (
        <div key={`n${pending.length}`} role="status" className="a-rise mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 bg-primary px-4 py-3 text-primary-foreground">
          <b className="font-serif text-lg font-normal">{pending.length} online order{pending.length > 1 ? "s" : ""} to confirm</b>
          <div className="flex flex-1 flex-wrap gap-x-5 gap-y-1">
            {pending.slice(0, 4).map((o) => (
              <button key={o.id} onClick={() => open(o)} className="press text-left text-sm underline underline-offset-4 hover:opacity-80">
                {o.name}, {parse(o.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} {fmtTime(o.time)}
              </button>
            ))}
            {pending.length > 4 && <span className="text-sm opacity-75">and {pending.length - 4} more</span>}
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button onClick={() => go(week - 1)} className="press flex items-center gap-1 justify-self-start py-2 font-semibold text-foreground"><ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Last week</span></button>
        <div key={`w${week}`} className="a-fade text-center">
          <div className="font-serif text-2xl leading-none text-foreground">{short(first)} to {short(last)}</div>
          <button onClick={() => go(0)} className={`press mt-1 text-sm ${week ? "text-foreground underline underline-offset-4" : "text-muted-foreground"}`}>{week ? `${sub}, back to this week` : sub}</button>
        </div>
        <button onClick={() => go(week + 1)} className="press flex items-center gap-1 justify-self-end py-2 font-semibold text-foreground"><span className="hidden sm:inline">Next week</span> <ChevronRight className="h-4 w-4" /></button>
      </div>

      <div key={`g${week}`} className={`grid grid-cols-1 overflow-hidden border border-primary bg-card sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 ${dir}`}>
        {days.map((d) => {
          const k = iso(d), list = dayOrders(k), pcs = dayPieces(k), closed = s.closed[k], isToday = k === today;
          return (
            <section key={k} data-today={isToday || undefined} className={`flex min-h-[140px] flex-col sm:min-h-[520px] border-b border-r border-border last:border-r-0 ${isToday ? "bg-secondary/40" : ""}`}>
              <button onClick={() => setPanel({ kind: "bake", date: k })} className="border-b-2 border-primary px-3 py-3 text-left hover:bg-secondary active:bg-muted">
                <div className={`inline-block font-serif text-xl text-foreground ${isToday ? "border-b-2 border-accent" : ""}`}>{d.toLocaleDateString("en-US", { weekday: "long" })}</div>
                <div className="mt-0.5 flex items-center gap-2 text-sm">
                  <span className={pcs > DAILY_LIMIT ? "font-semibold text-destructive" : "text-muted-foreground"}>{short(d)} · {pcs} pc</span>
                  {closed && <span className="rounded-full border border-accent px-2 text-xs text-foreground">closed online</span>}
                </div>
                <div className="mt-2 h-1 bg-secondary"><div className={`growx h-full ${pcs > DAILY_LIMIT ? "bg-destructive" : "bg-accent"}`} style={{ width: `${Math.min(100, (pcs / DAILY_LIMIT) * 100)}%` }} /></div>
              </button>
              <div className="ruled flex-1">
                {list.map((o) => {
                  const done = !!s.done[o.id];
                  const soon = isToday && !done && !o.pending && o.time - clock <= 120 && o.time - clock >= -30;
                  const cls = ["ent group border-b border-border", done && "picked", picked.has(o.id) && "now", just.has(o.id) && "just", o.pending && "pending"].filter(Boolean).join(" ");
                  return (
                    <div key={o.id} className={cls}>
                      <div role="button" tabIndex={0} onClick={(e) => tap(e, o)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (o.pending) open(o); else setPop(o); } }}
                        aria-label={`${o.name}, ${fmtTime(o.time)}${done ? ", picked up" : ""}`}
                        className="body cursor-pointer select-none px-3 py-2.5 outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
                        <div className="flex items-center gap-2">
                          <span data-mark="t" className={`mark whitespace-nowrap px-1.5 font-mono text-[13px] font-medium ${marks[o.id + "t"] ? "marked" : ""} ${soon ? "soon" : ""} ${done ? "bg-muted-foreground text-card" : "bg-primary text-primary-foreground"}`}>{fmtTime(o.time)}</span>
                          {o.pending ? <span className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-foreground">new online</span>
                            : <span className="text-xs text-muted-foreground">{o.source === "online" ? "online" : "by hand"} · {orderPieces(o, idx)} pc</span>}
                          {o.pending
                            ? <button onClick={(e) => { e.stopPropagation(); confirmNew(o); }} className="press ml-auto bg-accent px-2.5 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-accent-foreground hover:bg-accent/90">Confirm</button>
                            : <button onClick={(e) => { e.stopPropagation(); open(o); }} className="press ml-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">edit</button>}
                        </div>
                        <div className="strike font-hand text-2xl font-medium leading-tight text-foreground"><span data-mark="n" className={`mark ${marks[o.id + "n"] ? "marked" : ""}`}>{o.name}</span></div>
                        {o.items.map((i, n) => <div key={n} className="strike font-hand text-lg leading-tight text-muted-foreground">{i.qty} x {i.code}</div>)}
                        {o.phone && <div className="text-xs text-muted-foreground">{o.phone}</div>}
                        {o.note && <div data-mark="c" className={`note-circle mark mt-1 ${marks[o.id + "c"] ? "marked" : ""}`}>{o.note}</div>}
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => setPanel({ kind: "write", date: k })} className="block w-full px-3 py-2 text-left text-muted-foreground hover:bg-secondary hover:text-foreground">+ write an order</button>
                <button onClick={() => void dispatch({ t: "closed", date: k, v: !closed }).then((r) => toast(r.ok ? (closed ? "Reopened to online orders" : "Closed to online orders") : r.error))} className="block w-full px-3 pb-3 text-left text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                  {closed ? "Reopen this day to online orders" : "Close this day to online orders"}
                </button>
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Tap an order when it is picked up. Tap a time, name or note to highlight it. Tap a day name for that day's bake list.
        <button onClick={exportCsv} className="press ml-3 underline underline-offset-2 hover:text-foreground">Export CSV</button>
      </p>

      <PickupBox o={pop} done={pop ? !!s.done[pop.id] : false} idx={idx} onClose={() => setPop(null)}
        onYes={(o, v) => { setPop(null); toggle(o.id, v); toast(v ? `Picked up: ${o.name}` : `${o.name} is back to not picked up`); }}
        onCancel={(o) => { setPop(null); void dispatch({ t: "delete", id: o.id }).then((r) => toast(r.ok ? "Order cancelled" : r.error)); }} />

      <Drawer open={!!active} onClose={close}>
        {active?.kind === "write" && <OrderForm key={active.order?.id ?? active.date} initial={active.order} date={active.date} weekOffset={active.order ? weekOf(active.order.date) : week} onDone={close} />}
        {active?.kind === "bake" && <BakeList date={active.date} onWrite={() => setPanel({ kind: "write", date: active.date })} />}
        {active?.kind === "numbers" && (() => {
          const max = Math.max(DAILY_LIMIT, ...days.map((d) => dayPieces(iso(d))));
          return (
            <div>
              <h2 className="pr-12 font-serif text-3xl text-foreground">{short(first)} to {short(last)}</h2>
              <div className="stagger mt-4 grid grid-cols-3">
                {[[weekOrders.length, "orders"], [weekOrders.reduce((n, o) => n + orderPieces(o, idx), 0), "pieces"], [money(weekOrders.reduce((n, o) => n + orderBooked(o, idx), 0)), "booked"]].map(([v, l]) => (
                  <div key={l}><div className="font-serif text-3xl text-foreground">{v}</div><div className="text-sm text-muted-foreground">{l}</div></div>
                ))}
              </div>
              <div className="mt-6 space-y-3">
                {days.map((d, i) => {
                  const p = dayPieces(iso(d));
                  return (
                    <div key={iso(d)} className="flex items-center gap-3">
                      <span className="w-16 text-foreground">{d.toLocaleDateString("en-US", { weekday: "short" })} {d.getDate()}</span>
                      <div className="h-4 flex-1 bg-secondary"><div className={`growx h-full ${p > DAILY_LIMIT ? "bg-destructive" : "bg-primary"}`} style={{ width: `${(p / max) * 100}%`, animationDelay: `${i * 0.04}s` }} /></div>
                      <span className="w-10 text-right tabular-nums text-foreground">{p}</span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-6 text-sm text-muted-foreground">Pieces booked per day. A day turns red above {DAILY_LIMIT}.</p>
            </div>
          );
        })()}
      </Drawer>
    </>
  );

  function BakeList({ date, onWrite }: { date: string; onWrite: () => void }) {
    const list = dayOrders(date);
    const rows = new Map<string, { label: string; pieces: number; parts: Map<number, number> }>();
    list.forEach((o) => o.items.forEach((i) => {
      const m = idx.get(i.code); if (!m) return;
      const label = m.product.name;
      const r = rows.get(label) ?? { label, pieces: 0, parts: new Map() };
      r.pieces += i.qty * m.size.pieces;
      r.parts.set(m.size.pieces, (r.parts.get(m.size.pieces) ?? 0) + i.qty);
      rows.set(label, r);
    }));
    const total = dayPieces(date);
    return (
      <div>
        <h2 className="pr-12 font-serif text-3xl leading-tight text-foreground">Bake list, {parse(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</h2>
        <div className={`a-rise mt-4 font-serif text-7xl leading-none tabular-nums ${total > DAILY_LIMIT ? "text-destructive" : "text-foreground"}`}>{total}</div>
        <p className="mt-1 text-muted-foreground">pieces across {list.length} order{list.length === 1 ? "" : "s"}, daily limit {DAILY_LIMIT}</p>
        <ul className="stagger mt-4">
          {[...rows.values()].sort((a, b) => b.pieces - a.pieces).map((r) => (
            <li key={r.label} className="border-t border-border py-3">
              <div className="flex justify-between font-serif text-xl text-foreground"><span>{r.label}</span><span className="tabular-nums">{r.pieces}</span></div>
              <div className="text-sm text-muted-foreground">{[...r.parts].sort((a, b) => b[0] - a[0]).map(([p, q]) => `${q} box${q > 1 ? "es" : ""} of ${p}`).join(", ")}</div>
            </li>
          ))}
        </ul>
        {list.length === 0 && <p className="mt-6 text-muted-foreground">Nothing booked for this day yet.</p>}
        <button onClick={onWrite} className="press mt-6 bg-primary px-5 py-3 font-semibold text-primary-foreground hover:opacity-90">Write an order</button>
      </div>
    );
  }
}

// The small centred box from Baklava: confirm the pickup, go back, or cancel the order (two taps).
function PickupBox({ o, done, idx, onClose, onYes, onCancel }: { o: Order | null; done: boolean; idx: ReturnType<typeof sizeIndex>; onClose: () => void; onYes: (o: Order, v: boolean) => void; onCancel: (o: Order) => void }) {
  const [arm, setArm] = useState(false);
  const yes = useRef<HTMLButtonElement>(null);
  useEffect(() => { setArm(false); if (!o) return; yes.current?.focus(); const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [o]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!o || typeof document === "undefined") return null;
  const items = o.items.map((i) => { const m = idx.get(i.code); return m ? `${i.qty} x ${m.product.name}, ${m.size.pieces}` : `${i.qty} x ${i.code}`; }).join("; ");
  return createPortal(
    <div className="scrim fixed inset-0 z-50 flex items-center justify-center bg-primary/45 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={done ? "Order picked up" : "Confirm order pickup"} className="a-popin w-full max-w-[360px] border-2 border-primary bg-card px-6 py-5">
        <h3 className="font-serif text-2xl font-medium leading-tight text-foreground">{done ? "Order picked up" : "Confirm order pickup"}</h3>
        <p className="mb-5 mt-1 text-muted-foreground">{o.name}, {fmtTime(o.time)}, {items}</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <button ref={yes} onClick={() => onYes(o, !done)} className="press flex-1 bg-primary px-5 py-3 font-mono text-sm font-medium uppercase tracking-[0.08em] text-primary-foreground hover:bg-primary/90 sm:flex-none">{done ? "Not picked up" : "Confirm"}</button>
          <button onClick={onClose} className="press text-foreground underline underline-offset-4">Back</button>
          <button onClick={() => (arm ? onCancel(o) : setArm(true))} className={`press ml-auto text-sm ${arm ? "font-semibold text-destructive" : "text-destructive underline underline-offset-4"}`}>{arm ? "Tap again to cancel order" : "Cancel order"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
