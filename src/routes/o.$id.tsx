import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { custOp, custStatus, dayHours, fmtTime, money, orderBooked, orderPieces, parse, refreshCustomer, remember, sizeIndex, useCustomerSync, useMine, usePublic, useSyncStatus, type MineOrder, type OrderStatus } from "@/lib/store";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Slip } from "@/components/site/Slip";
import { Conversation } from "@/components/chat/Conversation";

// A customer's own order page: live status, pickup details, and a conversation with the bakery.
export const Route = createFileRoute("/o/$id")({
  validateSearch: (s: Record<string, unknown>) => ({ k: typeof s["k"] === "string" ? (s["k"] as string) : "" }),
  head: () => ({ meta: [{ title: "Your order · Lunar Bakery" }, { name: "robots", content: "noindex" }] }),
  component: TrackPage,
});

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "pending", label: "Received" },
  { key: "confirmed", label: "Confirmed" },
  { key: "ready", label: "Ready" },
  { key: "picked", label: "Picked up" },
];
const STAMP: Record<OrderStatus, string> = { pending: "Received", confirmed: "Confirmed", ready: "Ready", picked: "Picked up", declined: "Not taken", cancelled: "Cancelled" };

function TrackPage() {
  const { id } = Route.useParams();
  const { k } = Route.useSearch();
  useCustomerSync();
  const mine = useMine();
  const pub = usePublic();
  const sync = useSyncStatus();
  const [waited, setWaited] = useState(false);
  useEffect(() => { if (k) { remember("orders", { id, token: k }); refreshCustomer(); } const t = setTimeout(() => setWaited(true), 7000); return () => clearTimeout(t); }, [id, k]);

  const o = mine.orders.find((x) => x.id === id);
  if (!o) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 pt-16">
          {!waited || sync === "loading" ? (
            <div aria-busy="true" aria-label="Loading your order"><div className="skel h-20 w-2/3" /><div className="skel mt-5 h-5 w-1/2" /><div className="skel mt-12 h-16 w-full" /></div>
          ) : (
            <div className="a-arrive max-w-xl">
              <h1 className="font-serif text-5xl font-medium leading-[0.95] tracking-[-0.02em] text-foreground">We could not find this order</h1>
              <p className="mt-4 text-lg text-muted-foreground">Open the link from the device you ordered on, or message us and we will look it up.</p>
              <a href="/order" className="press mt-8 inline-block bg-accent px-8 py-3 font-mono text-sm font-medium uppercase tracking-[0.08em] text-accent-foreground">Place an order »</a>
            </div>
          )}
        </main>
        <Footer compact />
      </div>
    );
  }
  return <Tracked o={o} pubDays={pub.days} products={pub.products} thread={mine.threads.find((t) => t.orderId === o.id)} token={o.token || k} />;
}

function Tracked({ o, pubDays, products, thread, token }: { o: MineOrder; pubDays: ReturnType<typeof usePublic>["days"]; products: ReturnType<typeof usePublic>["products"]; thread: ReturnType<typeof useMine>["threads"][number] | undefined; token: string }) {
  const st = custStatus(o);
  const first = o.name.split(" ")[0];
  const h = dayHours(pubDays[o.date]);
  const idx = sizeIndex(products);
  const lines = o.items.map((i) => ({ ...i, m: idx.get(i.code) })).filter((l) => l.m);
  const when = `${parse(o.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at ${fmtTime(o.time)}`;
  const [arm, setArm] = useState(false);
  const [cancelErr, setCancelErr] = useState("");
  useEffect(() => { if (!arm) return; const t = setTimeout(() => setArm(false), 3500); return () => clearTimeout(t); }, [arm]);
  // Reading the page marks the bakery's messages as seen.
  useEffect(() => { if (thread && thread.custSeen < thread.msgs.length) void custOp({ t: "read", thread: thread.id, token }); }, [thread?.msgs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy: Record<OrderStatus, [string, string]> = {
    pending: [`Thank you, ${first}.`, "Your order is with the bakers. We will confirm it shortly, and this page updates by itself."],
    confirmed: [`See you ${parse(o.date).toLocaleDateString("en-US", { weekday: "long" })}.`, `Confirmed for ${when}, at ${h.place}.`],
    ready: [`It's ready, ${first}.`, `Boxed and waiting for you at ${h.place}.`],
    picked: [`Enjoy, ${first}.`, "Picked up. Thank you for choosing Lunar."],
    declined: [`Sorry, ${first}.`, o.declined || "We could not take this order."],
    cancelled: ["Order cancelled.", "You cancelled this order. Nothing to pay. We hope to bake for you soon."],
  };
  const step = STEPS.findIndex((s) => s.key === st);
  const off = st === "declined" || st === "cancelled";
  const canCancel = st === "pending" || st === "confirmed";

  const cancel = async () => {
    if (!arm) return setArm(true);
    setArm(false);
    const r = await custOp({ t: "cancel", id: o.id, token });
    if (!r.ok) setCancelErr(r.error);
  };
  const ics = () => {
    const [y, m, d] = o.date.split("-");
    const pad = (n: number) => String(n).padStart(2, "0");
    const t = (min: number) => `${y}${m}${d}T${pad(Math.floor(min / 60))}${pad(min % 60)}00`;
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lunar Bakery//Pickup//EN", "BEGIN:VEVENT", `UID:${o.id}@lunarbakery`, `DTSTART:${t(o.time)}`, `DTEND:${t(o.time + 30)}`, "SUMMARY:Pick up Lunar Bakery order", `LOCATION:${h.place}`, `DESCRIPTION:${lines.map((l) => `${l.qty} x ${l.m!.product.name}, ${l.m!.size.pieces}`).join("\\n")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    a.download = "lunar-pickup.ics";
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto grid max-w-[1200px] gap-12 px-6 pb-24 pt-12 lg:grid-cols-[1fr_360px] lg:gap-16 lg:pt-16">
        <div className="min-w-0">
          <div key={st}>
            <h1 className="a-arrive font-serif text-[56px] font-medium leading-[0.92] tracking-[-0.03em] text-foreground sm:text-[88px]">{copy[st][0]}</h1>
            <p className="a-arrive mt-5 max-w-[46ch] text-lg leading-[1.45] text-muted-foreground" style={{ animationDelay: ".15s" }}>{copy[st][1]}</p>
          </div>

          {/* Progress: Received, Confirmed, Ready, Picked up */}
          {!off && (
            <ol className="a-rise mt-12 grid grid-cols-4" style={{ animationDelay: ".25s" }} aria-label="Order progress">
              {STEPS.map((s, i) => {
                const doneStep = i <= step;
                return (
                  <li key={s.key} className="relative pr-2" aria-current={i === step ? "step" : undefined}>
                    <div className="h-[3px] bg-border"><div className="h-full bg-accent transition-[width] duration-700 ease-[cubic-bezier(.16,1,.3,1)]" style={{ width: doneStep ? "100%" : "0%" }} /></div>
                    <p className={`mt-3 font-mono text-[11px] uppercase tracking-[0.08em] ${i === step ? "text-accent" : doneStep ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
                  </li>
                );
              })}
            </ol>
          )}

          {/* Pickup details */}
          <section className="a-rise mt-12 grid gap-6 border-y border-border py-6 sm:grid-cols-3" style={{ animationDelay: ".3s" }}>
            <div><p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">When</p><p className="mt-1 text-foreground">{when}</p></div>
            <div><p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Where</p><p className="mt-1 text-foreground">{h.place}</p></div>
            <div><p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Pay</p><p className="mt-1 text-foreground">{money(orderBooked(o, idx))} at pickup</p></div>
            {!off && st !== "picked" && (
              <div className="flex flex-wrap gap-x-6 gap-y-2 sm:col-span-3">
                <button onClick={ics} className="press text-sm underline underline-offset-4 hover:text-accent">Add to calendar</button>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(h.place)}`} target="_blank" rel="noopener noreferrer" className="text-sm underline underline-offset-4 hover:text-accent">Directions</a>
              </div>
            )}
          </section>

          {/* Talk to the bakery about this order */}
          <section className="mt-12">
            <h2 className="font-serif text-3xl font-medium tracking-[-0.01em] text-foreground">Message the bakery</h2>
            <p className="mt-1 text-muted-foreground">Questions or changes about this order. We reply right here.</p>
            <div className="mt-4 flex flex-col border border-border bg-background px-4 pb-4">
              <Conversation msgs={thread?.msgs ?? []} side="customer" them="Lunar" placeholder="Write to Lunar about this order"
                onSend={(text) => (thread ? custOp({ t: "say", thread: thread.id, token, text }) : Promise.resolve({ ok: false as const, error: "Messages are not available for this order." }))} />
            </div>
          </section>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
            <a href="/order" className="press border border-primary px-8 py-3 font-mono text-sm font-medium uppercase tracking-[0.08em] text-foreground hover:bg-primary hover:text-primary-foreground">Place another order</a>
            {canCancel && (
              <button onClick={() => void cancel()} className={`press text-sm ${arm ? "font-semibold text-destructive" : "text-destructive underline underline-offset-4"}`}>
                {arm ? "Tap again to cancel your order" : "Cancel my order"}
              </button>
            )}
            {cancelErr && <p className="a-rise text-sm text-destructive">{cancelErr}</p>}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Bookmark this page to follow your order. It stays on this device.</p>
        </div>

        <div className="a-arrive" style={{ animationDelay: ".1s" }}>
          <div className="lg:sticky lg:top-24">
            <Slip lines={lines} pcs={orderPieces(o, idx)} total={orderBooked(o, idx)} date={o.date} time={o.time} name={o.name} note={o.note} stamp={STAMP[st]} />
          </div>
        </div>
      </main>
      <Footer compact />
    </div>
  );
}
