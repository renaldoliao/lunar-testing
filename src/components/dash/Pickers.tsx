import { useState } from "react";
import { TIMES, fmtTime, money, type Item, type Product } from "@/lib/store";

// Shared by the order page and the dashboard's order form.

export function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [bump, setBump] = useState(0);
  const set = (n: number) => { onChange(Math.max(0, Math.min(99, n))); setBump((b) => b + 1); };
  return (
    <div className="flex items-center" aria-label={label}>
      <button type="button" aria-label={`One less ${label}`} disabled={value === 0} onClick={() => set(value - 1)}
        className="press-sm flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary text-lg font-semibold text-foreground disabled:border-border disabled:text-border">−</button>
      <b key={bump} className={`w-9 text-center font-serif text-xl tabular-nums ${value ? "text-foreground" : "text-muted-foreground"} ${bump ? "a-chip inline-block" : ""}`}>{value}</b>
      <button type="button" aria-label={`One more ${label}`} onClick={() => set(value + 1)}
        className="press-sm flex h-9 w-9 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground hover:opacity-90">+</button>
    </div>
  );
}

export function ItemPicker({ products, items, onChange, showCodes }: { products: Product[]; items: Item[]; onChange: (i: Item[]) => void; showCodes?: boolean }) {
  const qty = (code: string) => items.find((i) => i.code === code)?.qty ?? 0;
  const setQty = (code: string, n: number) => {
    const rest = items.filter((i) => i.code !== code);
    onChange(n > 0 ? (items.some((i) => i.code === code) ? items.map((i) => (i.code === code ? { ...i, qty: n } : i)) : [...items, { code, qty: n }]) : rest);
  };
  const list = products.filter((p) => p.sizes.some((s) => s.on));
  return (
    <div className="divide-y divide-border border-y border-border">
      {list.map((p) => (
        <div key={p.id} className="flex gap-4 py-4">
          {p.photo && <img src={p.photo} alt="" className="a-fade h-20 w-20 shrink-0 object-cover" />}
          <div className="min-w-0 flex-1">
            <div className="font-serif text-xl leading-tight text-foreground">{p.name}</div>
            <div className="mt-2 space-y-2">
              {p.sizes.filter((s) => s.on).map((s) => {
                const q = qty(s.code);
                return (
                  <div key={s.code} className="flex items-center gap-3">
                    <div className="flex-1 text-sm">
                      <span className={q ? "font-semibold text-foreground" : "text-foreground"}>Box of {s.pieces}</span>
                      <span className="ml-2 text-muted-foreground">{money(s.price)}</span>
                      
                    </div>
                    <Stepper value={q} onChange={(n) => setQty(s.code, n)} label={`${p.name} box of ${s.pieces}`} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="py-6 text-muted-foreground">Nothing on the menu right now.</p>}
    </div>
  );
}

export function TimeChips({ value, onChange, disabled, times = TIMES }: { value: number | ""; onChange: (t: number) => void; disabled?: (t: number) => boolean; times?: number[] }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
      {times.map((t) => {
        const on = value === t, off = disabled?.(t);
        return (
          <button key={t} type="button" disabled={off} onClick={() => onChange(t)}
            className={`press py-2 font-mono text-[13px] font-medium ${on ? "a-chip bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"} disabled:bg-transparent disabled:text-border disabled:line-through`}>
            {fmtTime(t)}
          </button>
        );
      })}
    </div>
  );
}
