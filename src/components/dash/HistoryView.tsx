import { useState, type ReactNode } from "react";
import { itemsText, downloadCsv, fmtTime, iso, mondayOf, money, orderBooked, orderPieces, parse, sizeIndex, useStore, type Order } from "@/lib/store";
import { Drawer } from "./Drawer";

const RANGES = ["All time", "This month", "Last 4 weeks", "This week"] as const;
type Range = (typeof RANGES)[number];
type Metric = "Orders" | "Pieces" | "Booked";
const SHADES = ["var(--primary)", "var(--brand-blue)", "var(--accent)", "var(--border)"];

function Pill({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className={`press rounded-full px-3 py-1 ${on ? "a-chip border-2 border-primary text-foreground" : "border-2 border-transparent text-muted-foreground hover:text-foreground"}`}>{children}</button>;
}
function H({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 border-b-2 border-primary pb-1 font-serif text-2xl text-foreground">{children}</h2>;
}
function Table({ head, rows, bar }: { head: string[]; rows: ReactNode[][]; bar?: number[] }) {
  return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-border text-muted-foreground">{head.map((h, i) => <th key={i} className={`py-2 font-semibold ${i ? "text-right" : "text-left"}`}>{h}</th>)}{bar && <th className="w-1/3" />}</tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i}>{r.map((c, j) => <td key={j} className={`py-2 ${j ? "text-right" : "text-left font-semibold text-foreground"}`}>{c}</td>)}
          {bar && <td className="pl-3"><div className="h-2.5 bg-secondary"><div className="growx h-full bg-primary" style={{ width: `${(bar[i] ?? 0) * 100}%`, animationDelay: `${Math.min(i, 8) * 0.03}s` }} /></div></td>}
        </tr>
      ))}</tbody>
    </table>
  );
}
function Donut({ parts, center, label }: { parts: { name: string; v: number }[]; center: string; label: string }) {
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  let acc = 0;
  const stops = parts.map((p, i) => { const a = acc; acc += (p.v / total) * 360; return `${SHADES[i % 4]} ${a}deg ${acc}deg`; }).join(",");
  return (
    <div className="flex items-center gap-6">
      <div className="spin-in relative h-28 w-28 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops})` }}>
        <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-card"><span className="font-semibold text-foreground">{center}</span><span className="text-[10px] text-muted-foreground">{label}</span></div>
      </div>
      <ul className="flex-1 space-y-1.5 text-sm">
        {parts.map((p, i) => <li key={p.name} className="flex items-center gap-2"><span className="h-3.5 w-3.5 border border-primary" style={{ background: SHADES[i % 4] }} /><span className="flex-1 text-foreground">{p.name}</span><b>{Math.round((p.v / total) * 100)}%</b></li>)}
      </ul>
    </div>
  );
}

export function HistoryView() {
  const s = useStore();
  const idx = sizeIndex(s.products);
  const [range, setRange] = useState<Range>("All time");
  const [metric, setMetric] = useState<Metric>("Pieces");
  const [q, setQ] = useState("");
  const [cust, setCust] = useState<string | null>(null);
  const now = new Date();
  const today = iso(now);
  const start = range === "This month" ? iso(new Date(now.getFullYear(), now.getMonth(), 1)) : range === "Last 4 weeks" ? iso(mondayOf(-3)) : range === "This week" ? iso(mondayOf(0)) : "0000";
  const orders = s.orders.filter((o) => o.date >= start);
  const P = (o: Order) => orderPieces(o, idx), B = (o: Order) => orderBooked(o, idx);
  const sum = (l: Order[]) => ({ n: l.length, p: l.reduce((a, o) => a + P(o), 0), b: l.reduce((a, o) => a + B(o), 0) });
  const tot = sum(orders);
  const custKey = (o: Order) => o.phone || o.name.toLowerCase();
  const custs = new Map<string, Order[]>();
  orders.forEach((o) => custs.set(custKey(o), [...(custs.get(custKey(o)) ?? []), o]));
  const back = [...custs.values()].filter((l) => l.length > 1).length;
  const val = (x: ReturnType<typeof sum>) => (metric === "Orders" ? x.n : metric === "Pieces" ? x.p : x.b);
  const groupBy = (key: (o: Order) => string) => { const m = new Map<string, Order[]>(); orders.forEach((o) => m.set(key(o), [...(m.get(key(o)) ?? []), o])); return m; };

  const weeks = [...groupBy((o) => iso(mondayOf(0, parse(o.date))))].sort((a, b) => b[0].localeCompare(a[0]));
  const months = [...groupBy((o) => o.date.slice(0, 7))].sort((a, b) => b[0].localeCompare(a[0]));
  const prod = new Map<string, { sold: number; p: number; b: number }>();
  orders.forEach((o) => o.items.forEach((i) => { const m = idx.get(i.code); if (!m) return; const k = `${m.product.name} ${m.size.pieces} pieces`; const r = prod.get(k) ?? { sold: 0, p: 0, b: 0 }; r.sold += i.qty; r.p += i.qty * m.size.pieces; r.b += i.qty * m.size.price; prod.set(k, r); }));
  const prodRows = [...prod].sort((a, b) => b[1].p - a[1].p);
  const prodParts = [...prodRows.slice(0, 3).map(([name, r]) => ({ name, v: r.p })), ...(prodRows.length > 3 ? [{ name: "Other", v: prodRows.slice(3).reduce((a, [, r]) => a + r.p, 0) }] : [])];
  const WD = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const byWd = WD.map((w, i) => ({ w, ...sum(orders.filter((o) => (parse(o.date).getDay() + 6) % 7 === i)) }));
  const src = (["online", "by hand"] as const).map((k) => ({ k, ...sum(orders.filter((o) => o.source === k)) }));
  const regulars = [...custs.values()].map((l) => ({ name: l[0]!.name, phone: l[0]!.phone, key: custKey(l[0]!), ...sum(l), last: l.map((o) => o.date).sort().at(-1)! })).filter((r) => (r.name + r.phone).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.n - a.n || b.b - a.b);
  const short = (d: string) => parse(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const wmax = Math.max(1, ...weeks.map(([, l]) => val(sum(l))));
  const dmax = Math.max(1, ...byWd.map((d) => d.n));

  const exportCsv = () => downloadCsv(`lunar-history-${range.toLowerCase().replace(/ /g, "-")}.csv`, [["Date", "Time", "Name", "Phone", "Items", "Pieces", "Booked", "Source", "Picked up"], ...orders.map((o) => [o.date, fmtTime(o.time), o.name, o.phone, itemsText(o, idx), P(o), B(o), o.source, s.done[o.id] ? "yes" : "no"])]);

  return (
    <div className="space-y-10 border border-primary bg-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm text-muted-foreground">Show</span>
        {RANGES.map((r) => <Pill key={r} on={range === r} onClick={() => setRange(r)}>{r}</Pill>)}
        <button onClick={exportCsv} className="press ml-auto text-sm text-muted-foreground underline hover:text-foreground">Export CSV or report</button>
      </div>
      <section>
        <H>{range}</H>
        <div key={range} className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[[tot.n, "orders"], [tot.p.toLocaleString(), "pieces"], [money(tot.b), "booked"], [money(tot.n ? Math.round((tot.b / tot.n) * 100) / 100 : 0), "average order"], [custs.size, `customers, ${back} came back`], [orders.filter((o) => s.done[o.id]).length, "picked up"]].map(([v, l]) => (
            <div key={String(l)}><div className="font-serif text-4xl tabular-nums text-foreground">{v}</div><div className="text-sm text-muted-foreground">{l}</div></div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Booked uses the current prices from the Products tab.</p>
      </section>
      <section>
        <H>Week by week</H>
        <div className="mb-4 flex items-center gap-2"><span className="mr-2 text-sm text-muted-foreground">Chart</span>{(["Orders", "Pieces", "Booked"] as Metric[]).map((m) => <Pill key={m} on={metric === m} onClick={() => setMetric(m)}>{m}</Pill>)}</div>
        <div className="flex h-36 items-end gap-2">
          {[...weeks].reverse().map(([w, l]) => { const v = val(sum(l)); return (
            <div key={w} className="flex w-20 flex-col items-center"><span className="font-semibold text-foreground">{metric === "Booked" ? money(v) : v}</span><div className="grow w-full bg-primary" style={{ height: `${(v / wmax) * 90}px` }} /><span className="mt-1 text-xs text-muted-foreground">{short(w)}</span></div>
          ); })}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">Each bar is a week, labelled with its Monday.</p>
      </section>
      <section>
        <H>By month</H>
        <Table head={["", "Orders", "Pieces", "Booked"]} bar={months.map(([, l]) => sum(l).b / Math.max(1, ...months.map(([, x]) => sum(x).b)))}
          rows={months.map(([m, l]) => { const x = sum(l); return [<>{parse(m + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })}{m === today.slice(0, 7) && <span className="ml-2 text-xs font-normal text-muted-foreground">this month</span>}</>, x.n, x.p, money(x.b)]; })} />
      </section>
      <section>
        <H>By week</H>
        <p className="mb-2 text-sm text-muted-foreground">Monday to Saturday, newest first.</p>
        <Table head={["", "Orders", "Pieces", "Booked"]} bar={weeks.map(([, l]) => sum(l).b / Math.max(1, ...weeks.map(([, x]) => sum(x).b)))}
          rows={weeks.map(([w, l]) => { const x = sum(l); const sat = parse(w); sat.setDate(sat.getDate() + 5); return [<>{short(w)} to {short(iso(sat))}{w === iso(mondayOf(0)) && <span className="ml-2 text-xs font-normal text-muted-foreground">this week</span>}</>, x.n, x.p, money(x.b)]; })} />
      </section>
      <div className="grid gap-10 lg:grid-cols-3">
        <section>
          <H>By product</H>
          <Donut parts={prodParts} center={tot.p.toLocaleString()} label="pieces" />
          <div className="mt-6"><Table head={["", "Sold", "Pieces", "Booked"]} rows={prodRows.map(([n, r]) => [n, r.sold, r.p, money(r.b)])} /></div>
        </section>
        <section>
          <H>By weekday</H>
          <div className="flex h-32 items-end gap-2">
            {byWd.map((d) => <div key={d.w} className="flex flex-1 flex-col items-center"><span className="font-semibold text-foreground">{d.n}</span><div className="grow w-full bg-primary" style={{ height: `${(d.n / dmax) * 80}px` }} /><span className="mt-1 text-xs text-muted-foreground">{d.w.slice(0, 3)}</span></div>)}
          </div>
          <div className="mt-6"><Table head={["", "Orders", "Pieces", "Booked"]} rows={byWd.map((d) => [d.w, d.n, d.p, money(d.b)])} /></div>
        </section>
        <section>
          <H>Online or by hand</H>
          <Donut parts={src.map((x) => ({ name: x.k === "online" ? "Online" : "By hand", v: x.n }))} center={String(tot.n)} label="orders" />
          <div className="mt-6"><Table head={["", "Orders", "Pieces", "Booked"]} rows={src.map((x) => [x.k === "online" ? "Online" : "By hand", x.n, x.p, money(x.b)])} /></div>
        </section>
      </div>
      <section>
        <H>Regulars</H>
        <p className="mb-3 text-sm text-muted-foreground">Orders in this range, matched by phone number or by name when there is none. Tap a name to see everything they have ordered.</p>
        <div className="mb-3 flex items-center gap-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone" className="w-64 border-b-2 border-primary bg-transparent py-1 outline-none" />
          <span className="text-sm text-muted-foreground">{regulars.length} customers</span>
        </div>
        <Table head={["", "Orders", "Pieces", "Booked", "Last order"]} rows={regulars.map((r) => [<button key={r.key} onClick={() => setCust(r.key)} className="press font-serif text-lg font-medium underline-offset-4 hover:underline">{r.name}</button>, r.n, r.p, money(r.b), short(r.last)])} />
      </section>
      <Drawer open={!!cust} onClose={() => setCust(null)}>
        {cust && (() => { const l = (s.orders.filter((o) => custKey(o) === cust)).sort((a, b) => b.date.localeCompare(a.date)); const x = sum(l); return (
          <div>
            <h2 className="font-serif text-4xl font-medium text-foreground">{l[0]?.name}</h2>
            <p className="text-muted-foreground">{l[0]?.phone}</p>
            <p className="mt-2 text-foreground">{x.n} orders · {x.p} pieces · {money(x.b)}</p>
            <ul className="mt-4">{l.map((o) => <li key={o.id} className="border-t border-border py-3"><div className="font-semibold text-foreground">{parse(o.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · {fmtTime(o.time)}</div><div className="text-[15px] text-muted-foreground">{itemsText(o, idx, ", ")}</div>{o.note && <div className="note-circle mt-1">{o.note}</div>}</li>)}</ul>
          </div>
        ); })()}
      </Drawer>
    </div>
  );
}
