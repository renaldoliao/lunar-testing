import { useEffect, useState } from "react";
import { dispatch, fmtTime, money, orderBooked, orderPieces, parse, sizeIndex, statusOf, useStore, type Order, type OrderStatus } from "@/lib/store";
import { Conversation } from "@/components/chat/Conversation";
import { OrderForm } from "./OrderForm";
import { toast } from "./Toast";

/*
 * One order, everything in one place: where it stands, the next step in one tap,
 * the conversation with the customer, and the details to edit.
 * Every step the bakery takes also updates the customer's own order page.
 */
const LABEL: Record<OrderStatus, string> = { pending: "New, waiting for you", confirmed: "Confirmed", ready: "Ready on the shelf", picked: "Picked up", declined: "Declined", cancelled: "Cancelled by the customer" };
const REASONS = ["That day is fully booked", "That box is sold out that day", "We are closed that day"];

export function OrderPanel({ order, weekOffset, onDone }: { order: Order; weekOffset: number; onDone: () => void }) {
  const s = useStore();
  const o = s.orders.find((x) => x.id === order.id) ?? order;
  const st = statusOf(o, s.done);
  const idx = sizeIndex(s.products);
  const thread = Object.values(s.threads ?? {}).find((t) => t.orderId === o.id);
  const [editing, setEditing] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState(REASONS[0]!);
  const [busy, setBusy] = useState(false);
  const first = o.name.split(" ")[0];
  useEffect(() => { if (thread && thread.staffSeen < thread.msgs.length) void dispatch({ t: "seen", thread: thread.id }); }, [thread?.msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (op: Parameters<typeof dispatch>[0], msg: string) => {
    setBusy(true);
    const r = await dispatch(op);
    setBusy(false);
    toast(r.ok ? msg : r.error);
  };
  const primary = "press bg-primary px-5 py-3 font-mono text-sm font-medium uppercase tracking-[0.08em] text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
  const quiet = "press text-sm underline underline-offset-4 text-foreground hover:text-accent";

  if (editing) return <OrderForm initial={o} date={o.date} weekOffset={weekOffset} onDone={() => setEditing(false)} />;

  return (
    <div className="space-y-7 pb-6 pr-1">
      <div className="a-rise pr-14">
        <span key={st} className={`a-chip inline-block px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] ${st === "pending" ? "bg-accent text-accent-foreground" : st === "cancelled" || st === "declined" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>{LABEL[st]}</span>
        <h2 className="mt-3 font-serif text-4xl font-medium leading-tight tracking-[-0.01em] text-foreground">{o.name}</h2>
        <p className="mt-1 text-foreground">{parse(o.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at {fmtTime(o.time)}</p>
        <p className="text-sm text-muted-foreground">
          {o.source === "online" ? "Ordered online" : "Written by hand"}{o.placed ? `, ${new Date(o.placed).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
          {o.phone && <> · <a href={`tel:${o.phone}`} className="underline underline-offset-4">{o.phone}</a> · <a href={`sms:${o.phone}`} className="underline underline-offset-4">Text</a></>}
        </p>
      </div>

      {/* What's in the box */}
      <div className="border-y border-border py-3">
        {o.items.map((i) => { const m = idx.get(i.code); return (
          <div key={i.code} className="flex items-baseline justify-between py-1 text-[16px] text-foreground">
            <span><span className="mr-2 font-mono text-[13px] text-muted-foreground">{i.qty}×</span>{m ? m.product.name : i.code}{m && <span className="text-muted-foreground"> · {m.size.pieces} pc</span>}</span>
            <span className="text-sm text-muted-foreground">{m ? money(m.size.price * i.qty) : ""}</span>
          </div>
        ); })}
        {o.note && <div className="note-circle mt-2">{o.note}</div>}
        <div className="mt-2 flex justify-between text-sm text-muted-foreground"><span>{orderPieces(o, idx)} pieces</span><span>{money(orderBooked(o, idx))} at pickup</span></div>
      </div>

      {/* The next step, one tap */}
      <div className="space-y-3">
        {st === "pending" && !declining && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <button disabled={busy} onClick={() => void act({ t: "status", id: o.id, s: "confirm" }, `Confirmed. ${first} can see it on their order page.`)} className={primary}>Confirm order</button>
            <button onClick={() => setDeclining(true)} className={quiet}>Can't take it</button>
          </div>
        )}
        {declining && (
          <div className="a-rise border border-border bg-secondary/60 p-4">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Tell {first} why</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {REASONS.map((r) => <button key={r} onClick={() => setReason(r)} className={`press rounded-full border px-3 py-1 text-sm ${reason === r ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:border-primary"}`}>{r}</button>)}
            </div>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-border bg-card px-3 py-2 outline-none focus:border-primary" />
            <div className="mt-3 flex items-center gap-5">
              <button disabled={busy || !reason.trim()} onClick={() => void act({ t: "status", id: o.id, s: "decline", reason: reason.trim() }, `Declined. ${first} has been told why.`).then(() => setDeclining(false))} className={primary}>Send and decline</button>
              <button onClick={() => setDeclining(false)} className={quiet}>Back</button>
            </div>
          </div>
        )}
        {st === "confirmed" && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <button disabled={busy} onClick={() => void act({ t: "status", id: o.id, s: "ready" }, `Marked ready. ${first} sees it now.`)} className={primary}>Mark ready</button>
            <button disabled={busy} onClick={() => void act({ t: "done", id: o.id, v: true }, `Picked up: ${o.name}`)} className={quiet}>Picked up</button>
          </div>
        )}
        {st === "ready" && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <button disabled={busy} onClick={() => void act({ t: "done", id: o.id, v: true }, `Picked up: ${o.name}`)} className={primary}>Picked up</button>
            <button disabled={busy} onClick={() => void act({ t: "status", id: o.id, s: "unready" }, "Back to confirmed")} className={quiet}>Not ready yet</button>
          </div>
        )}
        {st === "picked" && (
          <div className="flex items-center gap-6"><p className="text-foreground">Picked up. All done.</p><button onClick={() => void act({ t: "done", id: o.id, v: false }, "Back to not picked up")} className={quiet}>Undo</button></div>
        )}
        {st === "declined" && <p className="text-muted-foreground">You declined this order: {o.declined}</p>}
        {st === "cancelled" && <p className="text-muted-foreground">{first} cancelled this order. It no longer counts toward the day.</p>}
      </div>

      {/* The conversation with the customer */}
      {thread ? (
        <div>
          <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Messages with {first}</p>
          <div className="flex flex-col border border-border bg-background px-3 pb-3">
            <Conversation msgs={thread.msgs} side="bakery" them={first ?? "Customer"} placeholder={`Message ${first}`} onSend={(text) => dispatch({ t: "reply", thread: thread.id, text })} />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Written by hand, so there is no chat for this order. Call or text {first} instead.</p>
      )}

      <div className="flex items-center gap-6 border-t border-border pt-4">
        <button onClick={() => setEditing(true)} className={quiet}>Edit details</button>
        <button onClick={onDone} className={quiet}>Close</button>
      </div>
    </div>
  );
}
