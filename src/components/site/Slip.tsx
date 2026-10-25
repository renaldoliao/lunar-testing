import { fmtTime, money, parse, type Item, type sizeIndex } from "@/lib/store";

// The order written out on a paper slip, the way the bakery sees it.
export type Line = Item & { m: ReturnType<ReturnType<typeof sizeIndex>["get"]> };
export function Slip({ lines, pcs, total, date, time, name, note, stamp }: { lines: Line[]; pcs: number; total: number; date: string; time: number | ""; name: string; note: string; stamp?: string | undefined }) {
  return (
    <div className="relative border border-primary bg-card px-5 pb-5 pt-4">
      <div className="flex items-baseline justify-between border-b-2 border-primary pb-2">
        <span className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Your order</span>
        <span className="text-sm text-muted-foreground">{pcs} pc</span>
      </div>
      <div className="min-h-[136px] pt-2">
        {date && time !== "" && <div className="a-rise"><span className="bg-primary px-1.5 font-mono text-[13px] font-medium text-primary-foreground">{fmtTime(time)}</span> <span className="text-sm text-foreground">{parse(date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span></div>}
        {name.trim() && <div className="mt-2 font-serif text-2xl font-medium leading-tight text-foreground">{name.trim()}</div>}
        {lines.map((l) => (
          <div key={l.code} className="a-rise flex items-baseline justify-between border-b border-border/70 py-2 text-[15px] text-foreground">
            <span><span className="mr-2 font-mono text-[13px] text-muted-foreground">{l.qty}×</span>{l.m!.product.name}<span className="text-muted-foreground"> · {l.m!.size.pieces} pc</span></span>
            <span className="text-sm text-muted-foreground">{money(l.qty * l.m!.size.price)}</span>
          </div>
        ))}
        {!lines.length && <p className="py-2 text-muted-foreground">Add a box to start.</p>}
        {note.trim() && <div className="note-circle mt-3">{note.trim()}</div>}
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t-2 border-primary pt-3">
        <span className="text-sm text-muted-foreground">Total, paid at pickup</span>
        <span key={total} className="a-chip font-serif text-3xl text-foreground">{money(total)}</span>
      </div>
      {stamp && <div key={stamp} className="a-popin absolute -right-3 -top-4 rotate-[8deg] rounded-full border-2 border-accent bg-card px-3 py-1 font-mono text-xs font-medium uppercase tracking-[0.08em] text-foreground" style={{ animationDelay: ".3s" }}>{stamp}</div>}
    </div>
  );
}
