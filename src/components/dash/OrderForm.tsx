import { useEffect, useState } from "react";
import { DAILY_LIMIT, dayPiecesOf, iso, money, orderBooked, orderPieces, parse, dispatch, sizeIndex, uid, useStore, weekDays, type Order } from "@/lib/store";
import { ItemPicker, TimeChips } from "./Pickers";
import { toast } from "./Toast";

export function OrderForm({ initial, date, weekOffset, onDone, embedded }: { initial?: Order | undefined; date: string; weekOffset: number; onDone: () => void; embedded?: boolean }) {
  const s = useStore();
  const { products } = s;
  const [d, setD] = useState(initial?.date ?? date);
  const [time, setTime] = useState<number | "">(initial?.time ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [text, setText] = useState(initial?.text ?? false);
  const [items, setItems] = useState(initial?.items ?? []);
  const [note, setNote] = useState(initial?.note ?? "");
  const [err, setErr] = useState("");
  const [sure, setSure] = useState(false);
  useEffect(() => setErr(""), [time, name, items]);
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 3000); return () => clearTimeout(t); }, [sure]);

  const days = weekDays(weekOffset);
  const today = iso(new Date());
  const idx = sizeIndex(products);
  const draft = { items } as Order;
  const pcs = orderPieces(draft, idx), total = orderBooked(draft, idx);
  const dayLoad = dayPiecesOf(s, d) - (initial && initial.date === d ? orderPieces(initial, idx) : 0) + pcs;
  // Codes on an older order whose size was removed or switched off still show, so nothing is lost.
  const orphans = items.filter((i) => !products.some((p) => p.sizes.some((z) => z.on && z.code === i.code)));

  const build = (pending: boolean): Order => ({ ...(initial ?? {}), id: initial?.id ?? uid(), date: d, time: time as number, name: name.trim(), phone: phone.trim(), items, note: note.trim(), text, source: initial?.source ?? "by hand", pending, placed: initial?.placed ?? Date.now() });
  const check = () => {
    if (time === "") return setErr("Pick a pickup time."), false;
    if (!name.trim()) return setErr("Add the customer's name."), false;
    if (items.length === 0) return setErr("Add at least one box."), false;
    return true;
  };
  const save = () => {
    if (!check()) return;
    const o = build(!!initial?.pending);
    onDone();
    void dispatch(initial ? { t: "update", order: o } : { t: "add", order: o }).then((r) => toast(r.ok ? (initial ? `Saved ${o.name}'s order` : `Added ${o.name}, ${fmtDay(o.date)}`) : r.error));
  };
  const del = () => {
    if (!initial) return;
    if (!sure) return setSure(true);
    onDone();
    void dispatch({ t: "delete", id: initial.id }).then((r) => toast(r.ok ? `Deleted ${initial.name}'s order` : r.error));
  };
  const label = "mb-2 block text-xs font-mono font-medium uppercase tracking-[0.08em] text-muted-foreground";
  const input = "w-full border-b-2 border-border bg-transparent py-1.5 text-lg outline-none focus:border-primary";

  return (
    <div className={`space-y-6 pr-2 ${embedded ? "pt-2" : "pb-24"}`}>
      <div className={`a-rise pr-12 ${embedded ? "hidden" : ""}`}>
        <p className="text-sm text-muted-foreground">{initial ? "Edit order" : "Write an order"}</p>
        <p className="font-serif text-3xl leading-[1.05] text-foreground">{parse(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>

      <div>
        <span className={label}>Pickup day</span>
        <div className="grid grid-cols-6 gap-1.5">
          {days.map((x) => {
            const k = iso(x), sel = k === d;
            return (
              <button key={k} type="button" onClick={() => setD(k)} className={`press py-1.5 text-center ${sel ? "a-chip bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"}`}>
                <div className="text-xs opacity-75">{x.toLocaleDateString("en-US", { weekday: "short" })}</div>
                <div className={`text-lg font-semibold ${k === today ? "underline decoration-2 underline-offset-2" : ""}`}>{x.getDate()}</div>
              </button>
            );
          })}
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">Another date
          <input type="date" value={d} onChange={(e) => e.target.value && setD(e.target.value)} className="border-b border-border bg-transparent text-foreground outline-none focus:border-primary" />
        </label>
      </div>

      <div><span className={label}>Pickup time</span><TimeChips value={time} onChange={setTime} /></div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block"><span className={label}>Name</span><input value={name} onChange={(e) => setName(e.target.value)} className={input} /></label>
        <label className="block"><span className={label}>Phone</span><input value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value)} className={input} /></label>
      </div>

      <div>
        <span className={label}>Boxes</span>
        {orphans.map((o) => (
          <div key={o.code} className="flex items-center gap-3 border-b border-border py-2 text-sm">
            <span className="code-chip">{o.code}</span><span className="flex-1 text-muted-foreground">{o.qty} x, no longer on the menu</span>
            <button type="button" onClick={() => setItems(items.filter((i) => i.code !== o.code))} className="press text-muted-foreground underline hover:text-destructive">remove</button>
          </div>
        ))}
        <ItemPicker products={products} items={items} onChange={setItems} />
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-muted-foreground">{pcs} pieces · {money(total)}</span>
          <span className={dayLoad > DAILY_LIMIT ? "font-semibold text-destructive" : "text-muted-foreground"}>{dayLoad} of {DAILY_LIMIT} for the day</span>
        </div>
      </div>

      <label className="block"><span className={label}>Note</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="less sweet, gift box, call when outside" className={input} />
      </label>

      <label className="flex cursor-pointer gap-3">
        <input type="checkbox" checked={text} onChange={(e) => setText(e.target.checked)} className="mt-1 h-5 w-5 accent-primary" />
        <span className="text-sm"><span className="font-semibold text-foreground">Happy to be texted</span><br /><span className="text-muted-foreground">Ask them first. Tick this only if they say yes.</span></span>
      </label>

      <div className="sticky bottom-0 -mx-6 mt-2 flex items-center gap-4 border-t border-border bg-card px-6 py-4">
        {err && <p key={err} className="a-rise absolute -top-9 left-6 bg-destructive px-2 py-1 text-sm text-destructive-foreground">{err}</p>}
        <button onClick={save} className="press bg-primary px-5 py-3 font-mono text-sm font-medium uppercase tracking-[0.08em] text-primary-foreground hover:opacity-90">{initial ? "Save changes" : "Save order"}</button>
        <button onClick={onDone} className="press underline underline-offset-4">Cancel</button>
        {initial && <button onClick={del} className={`press ml-auto text-sm ${sure ? "bg-destructive px-3 py-2 font-semibold text-destructive-foreground" : "text-destructive underline"}`}>{sure ? "Tap again to delete" : "Delete"}</button>}
      </div>
    </div>
  );
}
const fmtDay = (d: string) => parse(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
