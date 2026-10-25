import { useEffect, useState } from "react";
import { dispatch, fmtTime, parse, statusOf, useStore, type Thread } from "@/lib/store";
import { Conversation } from "@/components/chat/Conversation";
import { openOrder } from "./bus";

/*
 * Messages: every conversation with customers in one place.
 * Questions from the website chat, and chats about a specific order.
 */
const ago = (at: number) => {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 60 * 24) return `${Math.round(m / 60)}h`;
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
export const unreadIn = (t: Thread) => t.msgs.slice(t.staffSeen).filter((m) => m.from === "customer").length;

export function Inbox() {
  const s = useStore();
  const threads = Object.values(s.threads ?? {}).sort((a, b) => b.at - a.at);
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  // On a wide screen, open the newest conversation straight away.
  useEffect(() => { if (!sel && threads[0] && window.innerWidth >= 1024) setSel(threads[0].id); }, [threads.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = sel ? s.threads?.[sel] : undefined;
  // Looking at a conversation marks it as read.
  useEffect(() => { if (cur && unreadIn(cur)) void dispatch({ t: "seen", thread: cur.id }); }, [cur?.id, cur?.msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = filter === "unread" ? threads.filter((t) => unreadIn(t) > 0) : threads;
  const order = cur?.orderId ? s.orders.find((o) => o.id === cur.orderId) : undefined;
  const st = order ? statusOf(order, s.done) : null;

  return (
    <div className="grid min-h-[70vh] border border-primary bg-card lg:grid-cols-[340px_1fr]">
      {/* Conversations */}
      <aside className={`border-border lg:border-r ${cur ? "hidden lg:block" : ""}`}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-serif text-2xl font-medium text-foreground">Messages</h2>
          <div className="flex gap-1">
            {(["all", "unread"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`press rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{f}</button>
            ))}
          </div>
        </div>
        {!list.length && <p className="px-4 py-10 text-center font-serif italic text-muted-foreground">{filter === "unread" ? "All caught up." : "No conversations yet. Messages from the website and from orders land here."}</p>}
        <ul className="stagger">
          {list.map((t) => {
            const n = unreadIn(t), last = t.msgs[t.msgs.length - 1];
            const o = t.orderId ? s.orders.find((x) => x.id === t.orderId) : undefined;
            return (
              <li key={t.id}>
                <button onClick={() => setSel(t.id)} className={`block w-full border-b border-border px-4 py-3 text-left hover:bg-secondary ${sel === t.id ? "bg-secondary" : ""}`}>
                  <div className="flex items-baseline gap-2">
                    <span className={`flex-1 truncate font-serif text-lg ${n ? "font-semibold text-foreground" : "text-foreground"}`}>{t.name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{ago(t.at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex-1 truncate text-sm ${n ? "text-foreground" : "text-muted-foreground"}`}>{last ? `${last.from === "bakery" ? "You: " : ""}${last.text}` : "No messages"}</span>
                    {n > 0 && <span className="rounded-full bg-accent px-2 font-mono text-[11px] text-accent-foreground">{n}</span>}
                  </div>
                  <span className="mt-1 inline-block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {o ? `Order · ${parse(o.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ${fmtTime(o.time)}` : "Website chat"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* The conversation */}
      <section className={`flex min-h-[70vh] flex-col ${cur ? "" : "hidden lg:flex"}`}>
        {!cur ? (
          <div className="m-auto px-6 text-center font-serif italic text-muted-foreground">Choose a conversation.</div>
        ) : (
          <div key={cur.id} className="a-fade flex flex-1 flex-col">
            <div className="flex flex-wrap items-start gap-x-6 gap-y-2 border-b border-border px-5 py-4">
              <button onClick={() => setSel(null)} className="press -ml-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">‹ All</button>
              <div className="flex-1">
                <p className="font-serif text-2xl font-medium leading-tight text-foreground">{cur.name}</p>
                <p className="text-sm text-muted-foreground">
                  {cur.phone ? <><a href={`tel:${cur.phone}`} className="underline underline-offset-4 hover:text-foreground">{cur.phone}</a> · <a href={`sms:${cur.phone}`} className="underline underline-offset-4 hover:text-foreground">Text</a></> : "No phone number"}
                </p>
              </div>
              {order && (
                <button onClick={() => openOrder(order.id)} className="press border border-primary px-3 py-2 text-left hover:bg-secondary">
                  <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{st === "pending" ? "Needs confirming" : st}</span>
                  <span className="block text-sm text-foreground">{parse(order.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, {fmtTime(order.time)} · Open order ›</span>
                </button>
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-5 pb-5">
              <Conversation msgs={cur.msgs} side="bakery" them={cur.name.split(" ")[0] ?? "Customer"} tall placeholder={`Reply to ${cur.name.split(" ")[0]}`} onSend={(text) => dispatch({ t: "reply", thread: cur.id, text })} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
