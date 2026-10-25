import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { custOp, custStatus, fmtTime, me, parse, remember, secret, uid, useCustomerSync, useMine } from "@/lib/store";
import { Conversation } from "@/components/chat/Conversation";

/*
 * "Ask Lunar": a small chat in the corner of every customer page.
 * Messages go straight to the bakery's inbox, and replies come back here.
 */
export function ChatBubble({ lift }: { lift?: boolean }) {
  useCustomerSync();
  const mine = useMine();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");
  useEffect(() => { setMounted(true); setName(me().name ?? ""); }, []);

  const key = mounted ? me().threads.find((t) => t.id.startsWith("c-")) : undefined;
  const thread = key ? mine.threads.find((t) => t.id === key.id) : undefined;
  const orderThreads = mine.threads.filter((t) => t.orderId);
  const unreadOf = (t: { msgs: { from: string }[]; custSeen: number }) => t.msgs.slice(t.custSeen).filter((m) => m.from === "bakery").length;
  const unread = (thread ? unreadOf(thread) : 0) + orderThreads.reduce((n, t) => n + unreadOf(t), 0);

  // Opening the chat marks the bakery's replies as read.
  useEffect(() => {
    if (open && thread && key && unreadOf(thread)) void custOp({ t: "read", thread: thread.id, token: key.token });
  }, [open, thread?.msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  const send = async (text: string) => {
    const k = key ?? { id: "c-" + uid(), token: secret() };
    // Keep the key first, so the reply check right after sending already knows this conversation.
    if (!key) remember("threads", k, { name: name.trim() || undefined });
    return custOp({ t: "say", thread: k.id, token: k.token, text, name: name.trim() || undefined, phone: me().phone });
  };

  if (!mounted) return null;
  return createPortal(
    <>
      {open && (
        <div role="dialog" aria-label="Message Lunar Bakery" className={`a-popin fixed right-4 z-40 flex max-h-[min(640px,calc(100dvh-120px))] w-[min(380px,calc(100vw-32px))] flex-col border-2 border-primary bg-background ${lift ? "bottom-40 lg:bottom-24" : "bottom-24"}`}>
          <div className="flex items-start justify-between border-b border-border bg-card px-5 py-4">
            <div>
              <p className="font-serif text-xl font-medium leading-tight text-foreground">Ask Lunar</p>
              <p className="text-sm text-muted-foreground">Orders, cakes, catering. We reply right here.</p>
            </div>
            <button onClick={() => setOpen(false)} className="press -mr-2 px-2 py-1 text-sm text-muted-foreground hover:text-foreground">Close</button>
          </div>
          {orderThreads.length > 0 && (
            <div className="border-b border-border px-5 py-3">
              <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">About your orders</p>
              {orderThreads.slice(-3).map((t) => {
                const o = mine.orders.find((x) => x.id === t.orderId);
                if (!o) return null;
                const n = unreadOf(t);
                return (
                  <a key={t.id} href={`/o/${o.id}?k=${o.token}`} onClick={() => setOpen(false)} className="flex items-center justify-between py-1 text-sm hover:text-accent">
                    <span className="underline underline-offset-4">{parse(o.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, {fmtTime(o.time)} · {custStatus(o)}</span>
                    {n > 0 && <span className="ml-2 rounded-full bg-accent px-2 font-mono text-[11px] text-accent-foreground">{n} new</span>}
                  </a>
                );
              })}
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
            {!key && (
              <label className="mt-3 block text-sm text-muted-foreground">Your name, so we know who we are talking to
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="mt-1 w-full border-b-2 border-border bg-transparent py-1.5 text-foreground outline-none focus:border-primary" />
              </label>
            )}
            <Conversation msgs={thread?.msgs ?? []} side="customer" them="Lunar" onSend={send}
              empty="Hello! Ask us anything about this week's pastries, pickups or a custom cake." placeholder="Write to Lunar" />
          </div>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Close messages" : unread ? `Messages, ${unread} new` : "Message Lunar"}
        className={`press fixed right-4 z-40 flex items-center gap-2 rounded-full bg-primary py-3 pl-4 pr-5 text-primary-foreground ${lift ? "bottom-24 lg:bottom-6" : "bottom-6"}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
        <span className="font-mono text-xs font-medium uppercase tracking-[0.08em]">{open ? "Close" : "Ask Lunar"}</span>
        {unread > 0 && !open && <span key={unread} className="a-chip absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 font-mono text-[11px] text-accent-foreground">{unread}</span>}
      </button>
    </>,
    document.body,
  );
}
