import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { checkStaffKey, getState, onArrive, onMessages, parse, fmtTime, setStaffKey, useStaffDenied, useStaffReady, useStaffSync, useStore, useSyncStatus } from "@/lib/store";
import { Inbox } from "@/components/dash/Inbox";
import { onOpenOrder } from "@/components/dash/bus";
import { Toaster, toast } from "@/components/dash/Toast";
import { WeekView } from "@/components/dash/WeekView";
import { HistoryView } from "@/components/dash/HistoryView";
import { ProductsView } from "@/components/dash/ProductsView";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Orders Dashboard · Lunar Bakery" },
      { name: "description", content: "Weekly pickup board, bake lists, history and products for Lunar Bakery." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Orders Dashboard · Lunar Bakery" },
      { property: "og:description", content: "Weekly pickup board, bake lists, history and products for Lunar Bakery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Logo({ big }: { big?: boolean }) {
  return <img src="/images/lunar-logo.png" alt="Lunar Artisan Baked Goods" className={`h-auto mix-blend-multiply ${big ? "w-56" : "w-32"}`} />;
}

// Shows staff whether changes reach every device or only this browser.
function SyncBadge() {
  const st = useSyncStatus();
  if (st === "loading") return null;
  const label = st === "live" ? "Live on all devices" : st === "offline" ? "Reconnecting..." : "This browser only";
  const tip = st === "live" ? "Orders and changes reach every phone and computer." : st === "offline" ? "No connection right now. Changes will retry." : "No database is connected yet, so orders stay in this browser. Connect one in Vercel to sync every device.";
  return (
    <span title={tip} className="a-fade hidden items-center gap-2 text-xs font-normal text-muted-foreground lg:inline-flex">
      <span className={`h-2 w-2 rounded-full ${st === "live" ? "bg-accent" : st === "offline" ? "soon-dot bg-destructive" : "border border-muted-foreground"}`} />{label}
    </span>
  );
}

function Index() {
  const [user, setUser] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { try { setUser(localStorage.getItem("lunar-user")); } catch { /* private mode */ } setReady(true); }, []);
  const sync = useSyncStatus();
  const denied = useStaffDenied();
  const signOut = () => { try { localStorage.removeItem("lunar-user"); localStorage.removeItem("lunar-key"); } catch { /* ignore */ } setUser(null); };
  if (!ready || (user && sync === "loading")) return <BoardSkeleton />;
  if (user && !denied) return <Dashboard onLogout={signOut} />;
  return <Login expired={!!user && denied} onLogin={(u) => { try { localStorage.setItem("lunar-user", u); } catch { /* ignore */ } setUser(u); }} />;
}

function BoardSkeleton() {
  return (
    <div className="min-h-screen bg-background px-5" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-10 py-5"><div className="skel h-9 w-28" /><div className="skel h-5 w-56" /></div>
      <div className="mx-auto mb-4 h-8 w-64 skel" />
      <div className="grid grid-cols-1 gap-px border border-border sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-3 bg-card p-3"><div className="skel h-6 w-28" /><div className="skel h-3 w-20" />
            {Array.from({ length: 3 }, (_, j) => <div key={j} className="skel h-16 w-full" />)}</div>
        ))}
      </div>
    </div>
  );
}

// One staff password, checked by the server, so customers' details stay private.
function Login({ onLogin, expired }: { onLogin: (u: string) => void; expired: boolean }) {
  const [u, setU] = useState("admin");
  const [p, setP] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(expired ? "Please sign in again." : "");
  const [out, setOut] = useState(false);
  const [checking, setChecking] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (out || checking) return;
    setChecking(true);
    const ok = await checkStaffKey(p);
    setChecking(false);
    if (!ok) return setErr("That password isn't right.");
    setStaffKey(p);
    setOut(true);
    setTimeout(() => onLogin(u.trim() || "staff"), 380);
  };
  const label = "font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground";
  const input = "mt-1 w-full border-b-2 border-border bg-transparent py-2 text-lg outline-none focus:border-primary";
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={(e) => void submit(e)} className={`a-arrive lockcard w-full max-w-[400px] border border-primary bg-card ${out ? "out" : ""}`}>
        <div className="flex flex-col items-center border-b border-primary bg-secondary px-8 py-10">
          <Logo big />
          <p className="mt-4 font-serif italic text-accent">French pastry, Taiwanese soul.</p>
        </div>
        <div className="space-y-5 p-8">
          <h1 className="font-serif text-2xl text-foreground">Orders dashboard</h1>
          <label className="block"><span className={label}>Name</span><input autoComplete="username" value={u} onChange={(e) => { setU(e.target.value); setErr(""); }} className={input} /></label>
          <label className="block"><span className={label}>Staff password</span>
            <div className="flex items-end gap-3"><input autoComplete="current-password" type={show ? "text" : "password"} value={p} onChange={(e) => { setP(e.target.value); setErr(""); }} className={input} /><button type="button" onClick={() => setShow(!show)} className="press pb-2 text-sm text-muted-foreground underline">{show ? "Hide" : "Show"}</button></div>
          </label>
          {err && <p key={err} className="a-rise text-sm text-destructive">{err}</p>}
          <button disabled={checking} className="press w-full bg-primary py-3 font-mono text-sm font-medium uppercase tracking-[0.08em] text-primary-foreground hover:opacity-90 disabled:opacity-70">{checking ? "Checking..." : "Sign in"}</button>
          <p className="border-t border-border pt-4 text-sm text-muted-foreground">Demo password: <span className="code-chip">lunar123</span></p>
        </div>
      </form>
    </main>
  );
}

const TABS = ["Week", "Messages", "History", "Products"] as const;
type Tab = (typeof TABS)[number];
function Dashboard({ onLogout }: { onLogout: () => void }) {
  useStaffSync();
  const s = useStore();
  const ready = useStaffReady();
  const [tab, setTab] = useState<Tab>("Week");
  const [shown, setShown] = useState<Tab>("Week");
  const [leaving, setLeaving] = useState(false);
  const [numbers, setNumbers] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const [bar, setBar] = useState({ x: 0, w: 0 });

  // The underline glides to whichever tab is on.
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const place = () => {
    const b = nav.current?.querySelector<HTMLButtonElement>(`[data-t="${tabRef.current}"]`);
    if (b) setBar((o) => (o.x === b.offsetLeft && o.w === b.offsetWidth ? o : { x: b.offsetLeft, w: b.offsetWidth }));
  };
  useLayoutEffect(place, [tab, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.addEventListener("resize", place);
    document.fonts?.ready.then(place);
    return () => window.removeEventListener("resize", place);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const switchTab = (t: Tab) => {
    if (t === tab || leaving) return;
    setTab(t);
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShown(t); return; }
    setLeaving(true);
    setTimeout(() => { setShown(t); setLeaving(false); window.scrollTo(0, 0); }, 140);
  };
  // "Open this order" from the inbox: go to the week board, which opens it.
  useEffect(() => onOpenOrder(() => { if (tabRef.current !== "Week") switchTab("Week"); }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // New orders and new messages from customers land here live.
  useEffect(() => onArrive((ids) => {
    const got = getState().orders.filter((x) => ids.includes(x.id) && x.pending);
    if (got.length === 1) toast(`New online order: ${got[0]!.name}, ${parse(got[0]!.date).toLocaleDateString("en-US", { weekday: "short" })} ${fmtTime(got[0]!.time)}`);
    else if (got.length > 1) toast(`${got.length} new online orders`);
  }), []);
  useEffect(() => onMessages((n) => {
    const t = Object.values(getState().threads ?? {}).sort((a, b) => b.at - a.at)[0];
    toast(n === 1 && t ? `New message from ${t.name}` : `${n} new messages`);
  }), []);

  const waiting = s.orders.filter((o) => o.pending && !o.cancelled).length;
  const unread = Object.values(s.threads ?? {}).reduce((n, t) => n + (t.msgs.length > t.staffSeen && t.msgs[t.msgs.length - 1]?.from === "customer" ? t.msgs.slice(t.staffSeen).filter((m) => m.from === "customer").length : 0), 0);
  useEffect(() => { const n = waiting + unread; document.title = n ? `(${n}) Lunar Orders` : "Orders Dashboard · Lunar Bakery"; }, [waiting, unread]);

  if (!ready) return <BoardSkeleton />;
  const link = "press font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground";
  return (
    <div className="a-arrive min-h-screen bg-background px-5 pb-12">
      <header className="flex flex-wrap items-center gap-x-10 gap-y-3 py-4">
        <Logo />
        <nav ref={nav} className="relative flex gap-1">
          {TABS.map((t) => {
            const n = t === "Week" ? waiting : t === "Messages" ? unread : 0;
            return (
              <button key={t} data-t={t} onClick={() => switchTab(t)} aria-pressed={tab === t}
                className={`relative px-3 py-2 font-medium ${tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t}{n > 0 && <span key={n} className="a-chip ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 font-mono text-[11px] text-accent-foreground">{n}</span>}
              </button>
            );
          })}
          <span className="tabbar" style={{ width: bar.w - 24, transform: `translateX(${bar.x + 12}px)` }} />
        </nav>
        <div className="ml-auto flex items-center gap-5">
          <SyncBadge />
          <a href="/" target="_blank" rel="noreferrer" className={`${link} hidden md:inline`}>Website ↗</a>
          <a href="/order" target="_blank" rel="noreferrer" className={link}>Order page ↗</a>
          <button onClick={onLogout} className={link}>Sign out</button>
        </div>
      </header>
      <div className={leaving ? "tab-out" : ""}>
        <div key={shown} className={`tab-in ${shown === "Week" ? "" : "pt-6"}`}>
          {shown === "Week" && <WeekView numbersOpen={numbers} setNumbersOpen={setNumbers} onMessages={() => switchTab("Messages")} />}
          {shown === "Messages" && <Inbox />}
          {shown === "History" && <HistoryView />}
          {shown === "Products" && <ProductsView />}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
