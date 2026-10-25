import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { DAILY_LIMIT, custOp, dayHours, fmtTime, iso, me, money, orderBooked, orderPieces, parse, remember, secret, sizeIndex, custStatus, uid, useCustomerSync, useMine, usePublic, useSyncStatus, type Item, type Order } from "@/lib/store";
import { ItemPicker, TimeChips } from "@/components/dash/Pickers";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Slip } from "@/components/site/Slip";
import { ChatBubble } from "@/components/site/ChatBubble";

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
const slots = (from: number, to: number) => { const out: number[] = []; for (let t = from; t <= to - 30; t += 30) out.push(t); return out; };

function OrderPage() {
  useCustomerSync();
  const pub = usePublic();
  const mine = useMine();
  const sync = useSyncStatus();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState<number | "">("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [text, setText] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  // Returning customers: their name and phone are already filled in.
  useEffect(() => { const m = me(); setName(m.name ?? ""); setPhone(m.phone ?? ""); setReady(true); }, []);

  const idx = sizeIndex(pub.products);
  const draft = { items } as Order;
  const pcs = orderPieces(draft, idx), total = orderBooked(draft, idx);
  const today = iso(new Date());
  const days = useMemo(() => upcomingDays(), []);
  const hoursOf = (k: string) => dayHours(pub.days[k]);
  const timesOf = (k: string) => slots(hoursOf(k).from, hoursOf(k).to).filter((t) => k !== today || t >= nowMin() + LEAD);
  const room = (k: string) => DAILY_LIMIT - (pub.load[k] ?? 0);
  const dayState = (k: string): "" | "Closed" | "Full" | "Past" => {
    if (pub.closed[k]) return "Closed";
    if (!timesOf(k).length) return "Past";
    if (room(k) < Math.max(pcs, 1)) return "Full";
    return "";
  };
  // If the bakery closes a day or it fills up while someone is choosing, step back gently.
  useEffect(() => { if (date && dayState(date)) { setDate(""); setTime(""); setErr("That day just closed or filled up. Please pick another."); } }, [pub, pcs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setErr(null), [items, date, time, name, phone]);

  const lines = items.map((i) => ({ ...i, m: idx.get(i.code) })).filter((l) => l.m);
  const digits = phone.replace(/\D/g, "");
  const upcoming = mine.orders.filter((o) => o.date >= today && ["pending", "confirmed", "ready"].includes(custStatus(o)));

  const place = () => {
    if (!items.length) return setErr("Add at least one box.");
    if (!date) return setErr("Choose a pickup day.");
    if (time === "") return setErr("Choose a pickup time.");
    if (!name.trim() || digits.length < 7) { detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); return setErr(!name.trim() ? "Add your name." : "Add a phone number so we can reach you."); }
    if (dayState(date)) return setErr("That day just filled up. Please pick another.");
    setSending(true);
    const o: Order = { id: uid(), date, time, name: name.trim(), phone: phone.trim(), items, note: note.trim(), text, source: "online", pending: true, placed: Date.now(), token: secret() };
    const started = Date.now();
    void custOp({ t: "place", order: o }).then(async (r) => {
      await new Promise((ok) => setTimeout(ok, Math.max(0, 500 - (Date.now() - started))));
      if (!r.ok) { setSending(false); return setErr(r.error); }
      remember("orders", { id: o.id, token: o.token! }, { name: o.name, phone: o.phone });
      void navigate({ to: "/o/$id", params: { id: o.id }, search: { k: o.token! } });
    });
  };

  if (!ready || sync === "loading") return <OrderSkeleton />;

  const label = "mb-3 block font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground";
  const input = "w-full border-b-2 border-border bg-transparent py-2 text-lg outline-none focus:border-primary";
  const h = date ? hoursOf(date) : null;

  return (
    <div className="min-h-screen bg-background">
      <Header onOrderPage />
      {upcoming.length > 0 && (
        <div className="a-rise border-b border-border bg-secondary">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-1 px-6 py-3 text-sm">
            <span className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground">Your orders</span>
            {upcoming.map((o) => (
              <a key={o.id} href={`/o/${o.id}?k=${o.token}`} className="underline underline-offset-4 hover:text-accent">
                {parse(o.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, {fmtTime(o.time)} · {custStatus(o) === "pending" ? "waiting to be confirmed" : custStatus(o) === "ready" ? "ready" : "confirmed"}
              </a>
            ))}
          </div>
        </div>
      )}

      <main className="mx-auto grid max-w-[1200px] gap-10 px-6 pb-24 pt-12 lg:grid-cols-[1fr_360px] lg:gap-16 lg:pt-16">
        <div className="min-w-0">
          <h1 className="a-arrive max-w-[12ch] font-serif text-[56px] font-medium leading-[0.92] tracking-[-0.03em] text-foreground sm:text-[88px]">Order for pickup</h1>
          <p className="a-arrive mt-5 max-w-[46ch] text-lg leading-[1.45] text-muted-foreground" style={{ animationDelay: ".2s" }}>
            Baked the morning you collect. Choose your boxes, a day and a time. You can follow your order and message us right after.
          </p>

          <section className="a-rise mt-14" style={{ animationDelay: ".28s" }}>
            <span className={label}>1 · Boxes</span>
            <ItemPicker products={pub.products} items={items} onChange={setItems} />
          </section>

          <section className="mt-14">
            <span className={label}>2 · Pickup day</span>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {days.map((d) => {
                const k = iso(d), st = dayState(k), on = date === k, left = room(k);
                const tag = st || (left < 80 ? "Almost full" : "Open");
                return (
                  <button key={k} type="button" disabled={!!st} onClick={() => { setDate(k); if (time !== "" && !timesOf(k).includes(time)) setTime(""); }}
                    aria-label={`${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${tag}`}
                    className={`press py-2.5 text-center ${on ? "a-chip bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"} disabled:bg-transparent disabled:text-muted-foreground disabled:opacity-60`}>
                    <div className="text-xs opacity-75">{k === today ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                    <div className="font-serif text-xl leading-tight">{d.getDate()}</div>
                    <div className={`font-mono text-[10px] uppercase tracking-[0.06em] ${!st && left < 80 && !on ? "text-accent" : ""}`}>{tag}</div>
                  </button>
                );
              })}
            </div>
            {date && h && (
              <div key={date} className="a-rise mt-6">
                <p className="mb-4 text-[15px] text-foreground">
                  Pickup at <span className="font-medium">{h.place}</span>, {fmtTime(h.from)} to {fmtTime(h.to)}.
                </p>
                <span className={label}>Time on {parse(date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
                <TimeChips value={time} onChange={setTime} times={timesOf(date)} />
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
              <span className="text-foreground">It is fine to text me about this order</span>
            </label>
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <Slip lines={lines} pcs={pcs} total={total} date={date} time={time} name={name} note={note} />
            {err && <p key={err} className="a-rise mt-3 text-sm text-destructive">{err}</p>}
            <button onClick={place} disabled={sending} className="press mt-4 w-full bg-accent py-4 font-mono font-medium uppercase tracking-[0.08em] text-accent-foreground hover:bg-accent/90 disabled:opacity-70">
              {sending ? "Sending..." : pcs ? `Place order · ${money(total)} »` : "Place order »"}
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">Pay when you collect. Nothing is charged online.</p>
          </div>
        </aside>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-primary bg-card px-5 py-3 lg:hidden">
        {err && <p key={err} className="a-rise mb-2 text-sm text-destructive">{err}</p>}
        <div className="flex items-center gap-4">
          <div className="flex-1 leading-tight">
            <div key={pcs} className={`font-serif text-2xl text-foreground ${pcs ? "a-chip" : ""}`}>{money(total)}</div>
            <div className="text-xs text-muted-foreground">{pcs ? `${pcs} pieces` : "No boxes yet"}{date && time !== "" ? `, ${parse(date).toLocaleDateString("en-US", { weekday: "short" })} ${fmtTime(time)}` : ""}</div>
          </div>
          <button onClick={place} disabled={sending} className="press bg-accent px-5 py-3 font-mono text-sm font-medium uppercase tracking-[0.08em] text-accent-foreground disabled:opacity-70">{sending ? "Sending..." : "Place order »"}</button>
        </div>
      </div>

      <div className="pb-20 lg:pb-0"><Footer compact /></div>
      <ChatBubble lift />
    </div>
  );
}

function OrderSkeleton() {
  return (
    <div className="min-h-screen bg-background" aria-busy="true" aria-label="Loading">
      <Header onOrderPage />
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="mt-12 grid gap-16 lg:grid-cols-[1fr_360px]">
          <div><div className="skel h-20 w-3/4" /><div className="skel mt-4 h-5 w-1/2" />
            <div className="mt-14 space-y-6">{Array.from({ length: 4 }, (_, i) => <div key={i} className="skel h-20 w-full" />)}</div></div>
          <div className="skel hidden h-80 lg:block" />
        </div>
      </div>
    </div>
  );
}
