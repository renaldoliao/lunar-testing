import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { DAILY_LIMIT, TIMES, dayPiecesOf, fmtTime, iso, money, orderBooked, orderPieces, parse, setState, sizeIndex, uid, useStore, type Item, type Order } from "@/lib/store";
import { ItemPicker, TimeChips } from "@/components/dash/Pickers";

export const Route = createFileRoute("/order")({
  head: () => ({
    meta: [
      { title: "Order for pickup · Lunar Bakery" },
      { name: "description", content: "Order Lunar's pastel de nata and kouign-amann by the box, then pick them up fresh." },
      { property: "og:title", content: "Order for pickup · Lunar Bakery" },
      { property: "og:description", content: "Pastel de nata and kouign-amann by the box, baked for your pickup time." },
    ],
  }),
  component: OrderPage,
});

const LEAD = 120; // same-day orders need two hours' notice

function upcomingDays(n = 12) {
  const out: Date[] = [];
  const d = new Date(); d.setHours(12, 0, 0, 0);
  while (out.length < n) { if (d.getDay() !== 0) out.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return out;
}
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };

function OrderPage() {
  const s = useStore();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const [items, setItems] = useState<Item[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState<number | "">("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [text, setText] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Order | null>(null);
  const [sending, setSending] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);

  const idx = sizeIndex(s.products);
  const draft = { items } as Order;
  const pcs = orderPieces(draft, idx), total = orderBooked(draft, idx);
  const today = iso(new Date());
  const days = useMemo(upcomingDays, []);
  const dayState = (k: string) => {
    if (s.closed[k]) return "Closed";
    if (k === today && TIMES.every((t) => t < nowMin() + LEAD)) return "Past";
    if (dayPiecesOf(s, k) + Math.max(pcs, 1) > DAILY_LIMIT) return "Full";
    return "";
  };
  // If the shop closes a day or it fills up while someone is ordering, let them know.
  useEffect(() => { if (date && dayState(date)) { setDate(""); setTime(""); } }, [s.closed, s.orders, pcs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setErr(null), [items, date, time, name, phone]);

  const lines = items.map((i) => ({ ...i, m: idx.get(i.code) })).filter((l) => l.m);
  const digits = phone.replace(/\D/g, "");

  const place = () => {
    if (!items.length) return setErr("Add at least one box.");
    if (!date) return setErr("Choose a pickup day.");
    if (time === "") return setErr("Choose a pickup time.");
    if (!name.trim() || digits.length < 7) { detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); return setErr(!name.trim() ? "Add your name." : "Add a phone number so we can confirm."); }
    if (dayState(date)) return setErr("That day just filled up. Please pick another.");
    setSending(true);
    const o: Order = { id: uid(), date, time, name: name.trim(), phone: phone.trim(), items, note: note.trim(), text, source: "online", pending: true, placed: Date.now() };
    setTimeout(() => {
      setState((x) => ({ ...x, orders: [...x.orders, o] }));
      setPlaced(o); setSending(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 450);
  };
  const again = () => { setPlaced(null); setItems([]); setDate(""); setTime(""); setNote(""); };

  if (!ready) return <OrderSkeleton />;

  const label = "mb-3 block text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground";
  const input = "w-full border-b-2 border-border bg-transparent py-2 text-lg outline-none focus:border-primary";

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-5 py-5 sm:px-10">
        <a href="/order" onClick={(e) => { if (placed) { e.preventDefault(); again(); } }} className="leading-none">
          <div className="font-sans text-2xl font-bold tracking-[0.12em] text-brand-blue">LUNAR</div>
          <div className="mt-1 text-[9px] tracking-[0.22em] text-accent">ARTISAN BAKED GOODS</div>
        </a>
        <p className="hidden font-serif italic text-muted-foreground sm:block">French pastry, Taiwanese soul.</p>
      </header>

      {placed ? (
        <Thanks o={placed} onAgain={again} />
      ) : (
        <main className="grid gap-10 px-5 pb-40 sm:px-10 lg:grid-cols-[1fr_380px] lg:gap-16 lg:pb-20">
          <div className="min-w-0">
            <h1 className="a-arrive max-w-[12ch] font-serif text-[56px] leading-[0.92] tracking-[-0.02em] text-foreground sm:text-[96px]">Order for pickup</h1>
            <p className="a-arrive mt-5 max-w-[46ch] text-lg leading-[1.45] text-muted-foreground" style={{ animationDelay: ".2s" }}>
              Baked the morning you collect. Choose your boxes, a day and a time, and we will text to confirm.
            </p>

            <section className="a-rise mt-14" style={{ animationDelay: ".28s" }}>
              <span className={label}>1 · Boxes</span>
              <ItemPicker products={s.products} items={items} onChange={setItems} />
            </section>

            <section className="mt-14">
              <span className={label}>2 · Pickup day</span>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {days.map((d) => {
                  const k = iso(d), st = dayState(k), on = date === k;
                  return (
                    <button key={k} type="button" disabled={!!st} onClick={() => { setDate(k); if (time !== "" && k === today && time < nowMin() + LEAD) setTime(""); }}
                      className={`press py-2.5 text-center ${on ? "a-chip bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"} disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-60`}>
                      <div className="text-xs opacity-75">{k === today ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                      <div className="font-serif text-xl leading-tight">{d.getDate()}</div>
                      <div className="text-[11px] tracking-[0.04em]">{st || d.toLocaleDateString("en-US", { month: "short" })}</div>
                    </button>
                  );
                })}
              </div>
              {date && (
                <div key={date} className="a-rise mt-6">
                  <span className={label}>Time on {parse(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
                  <TimeChips value={time} onChange={setTime} disabled={(t) => date === today && t < nowMin() + LEAD} />
                </div>
              )}
            </section>

            <section ref={detailsRef} className="mt-14 max-w-xl">
              <span className={label}>3 · Your details</span>
              <div className="grid gap-6 sm:grid-cols-2">
                <label className="block"><span className="text-sm text-muted-foreground">Name</span><input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
                <label className="block"><span className="text-sm text-muted-foreground">Phone</span><input autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={input} /></label>
              </div>
              <label className="mt-6 block"><span className="text-sm text-muted-foreground">Note for the bakers, optional</span>
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Gift box, less sweet, anything we should know" className={input} />
              </label>
              <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={text} onChange={(e) => setText(e.target.checked)} className="mt-0.5 h-5 w-5 accent-primary" />
                <span className="text-foreground">Text me a confirmation and a reminder on pickup day</span>
              </label>
            </section>
          </div>

          {/* The slip: your order written out the way the bakery will see it. */}
          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <Slip lines={lines} pcs={pcs} total={total} date={date} time={time} name={name} note={note} />
              {err && <p key={err} className="a-rise mt-3 text-sm text-destructive">{err}</p>}
              <button onClick={place} disabled={sending} className="press mt-4 w-full rounded-full bg-primary py-4 text-lg font-bold text-primary-foreground hover:opacity-90 disabled:opacity-70">
                {sending ? "Sending..." : pcs ? `Place order · ${money(total)}` : "Place order"}
              </button>
              <p className="mt-3 text-center text-xs text-muted-foreground">Pay when you collect. Nothing is charged online.</p>
            </div>
          </aside>
        </main>
      )}

      {!placed && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-primary bg-card px-5 py-3 lg:hidden">
          {err && <p key={err} className="a-rise mb-2 text-sm text-destructive">{err}</p>}
          <div className="flex items-center gap-4">
            <div className="flex-1 leading-tight">
              <div key={pcs} className={`font-serif text-2xl text-foreground ${pcs ? "a-chip" : ""}`}>{money(total)}</div>
              <div className="text-xs text-muted-foreground">{pcs ? `${pcs} pieces` : "No boxes yet"}{date && time !== "" ? `, ${parse(date).toLocaleDateString("en-US", { weekday: "short" })} ${fmtTime(time)}` : ""}</div>
            </div>
            <button onClick={place} disabled={sending} className="press rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground disabled:opacity-70">{sending ? "Sending..." : "Place order"}</button>
          </div>
        </div>
      )}

      <footer className={`flex flex-wrap gap-x-6 gap-y-2 border-t border-border px-5 py-6 text-sm text-muted-foreground sm:px-10 ${placed ? "" : "mb-24 lg:mb-0"}`}>
        <span>Lunar Bakery</span>
        <a href="/terms" className="underline underline-offset-2 hover:text-foreground">Terms</a>
        <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy</a>
        <a href="/" className="ml-auto hover:text-foreground">Staff</a>
      </footer>
    </div>
  );
}

type Line = Item & { m: ReturnType<ReturnType<typeof sizeIndex>["get"]> };
function Slip({ lines, pcs, total, date, time, name, note, stamp }: { lines: Line[]; pcs: number; total: number; date: string; time: number | ""; name: string; note: string; stamp?: boolean }) {
  return (
    <div className="ruled relative border border-primary bg-card px-5 pb-5 pt-4">
      <div className="flex items-baseline justify-between border-b-2 border-primary pb-2">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Your order</span>
        <span className="text-sm text-muted-foreground">{pcs} pc</span>
      </div>
      <div className="min-h-[136px] pt-2">
        {date && time !== "" && <div className="a-rise"><span className="bg-primary px-1.5 text-sm font-bold text-primary-foreground">{fmtTime(time)}</span> <span className="text-sm text-foreground">{parse(date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span></div>}
        {name.trim() && <div className="font-hand text-2xl font-bold leading-tight text-foreground">{name.trim()}</div>}
        {lines.map((l) => (
          <div key={l.code} className="a-rise flex items-baseline justify-between font-hand text-xl leading-[34px] text-foreground">
            <span>{l.qty} x {l.m!.product.name}, {l.m!.size.pieces}</span>
            <span className="font-sans text-sm text-muted-foreground">{money(l.qty * l.m!.size.price)}</span>
          </div>
        ))}
        {!lines.length && <p className="font-hand text-xl leading-[34px] text-muted-foreground">Add a box to start.</p>}
        {note.trim() && <div className="note-circle mt-1">{note.trim()}</div>}
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t-2 border-primary pt-3">
        <span className="text-sm text-muted-foreground">Total, paid at pickup</span>
        <span key={total} className="a-chip font-serif text-3xl text-foreground">{money(total)}</span>
      </div>
      {stamp && <div className="a-popin absolute -right-3 -top-4 rotate-[8deg] rounded-full border-2 border-accent bg-card px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-foreground" style={{ animationDelay: ".45s" }}>Received</div>}
    </div>
  );
}

function Thanks({ o, onAgain }: { o: Order; onAgain: () => void }) {
  const s = useStore();
  const idx = sizeIndex(s.products);
  const live = s.orders.find((x) => x.id === o.id) ?? o;
  const lines = live.items.map((i) => ({ ...i, m: idx.get(i.code) })).filter((l) => l.m);
  return (
    <main className="grid gap-12 px-5 pb-20 pt-6 sm:px-10 lg:grid-cols-[1fr_380px] lg:gap-16">
      <div>
        <h1 className="a-arrive font-serif text-[56px] leading-[0.92] tracking-[-0.02em] text-foreground sm:text-[96px]">Thank you, {live.name.split(" ")[0]}.</h1>
        <p className="a-arrive mt-6 max-w-[44ch] text-lg leading-[1.45] text-muted-foreground" style={{ animationDelay: ".2s" }}>
          {live.pending
            ? <>Your order is with the bakers. We will {live.text ? "text" : "call"} {live.phone} to confirm, usually within the hour.</>
            : <>Confirmed. See you {parse(live.date).toLocaleDateString("en-US", { weekday: "long" })} at {fmtTime(live.time)}.</>}
        </p>
        {!live.pending && <p className="a-rise mt-4 inline-block border-2 border-accent px-3 py-1 text-sm font-bold text-foreground">The bakery has confirmed your order</p>}
        <button onClick={onAgain} className="press a-arrive mt-10 rounded-full border-2 border-primary px-6 py-3 font-bold text-foreground hover:bg-primary hover:text-primary-foreground" style={{ animationDelay: ".3s" }}>Place another order</button>
      </div>
      <div className="a-arrive" style={{ animationDelay: ".15s" }}>
        <Slip lines={lines} pcs={orderPieces(live, idx)} total={orderBooked(live, idx)} date={live.date} time={live.time} name={live.name} note={live.note} stamp />
      </div>
    </main>
  );
}

function OrderSkeleton() {
  return (
    <div className="min-h-screen bg-background px-5 py-5 sm:px-10" aria-busy="true" aria-label="Loading">
      <div className="skel h-9 w-28" />
      <div className="mt-10 grid gap-16 lg:grid-cols-[1fr_380px]">
        <div><div className="skel h-20 w-3/4" /><div className="skel mt-4 h-5 w-1/2" />
          <div className="mt-14 space-y-6">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skel h-20 w-full" />)}</div></div>
        <div className="skel hidden h-80 lg:block" />
      </div>
    </div>
  );
}
