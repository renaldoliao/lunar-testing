import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getState, onArrive, parse, fmtTime, useStore, useSyncStatus } from "@/lib/store";
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
  if (!ready || (user && sync === "loading")) return <BoardSkeleton />;
  return user
    ? <Dashboard onLogout={() => { try { localStorage.removeItem("lunar-user"); } catch { /* ignore */ } setUser(null); }} />
    : <Login onLogin={(u) => { try { localStorage.setItem("lunar-user", u); } catch { /* ignore */ } setUser(u); }} />;
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

function Login({ onLogin }: { onLogin: (u: string) => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [out, setOut] = useState(false);
  const users = (): Record<string, string> => { try { return { admin: "lunar123", ...JSON.parse(localStorage.getItem("lunar-users") || "{}") }; } catch { return { admin: "lunar123" }; } };
  const enter = (name: string) => { setOut(true); setTimeout(() => onLogin(name), 380); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (out) return;
    if (mode === "in") return users()[u.trim()] === p ? enter(u.trim()) : setErr("That username or password isn't right.");
    if (!u.trim()) return setErr("Choose a username.");
    if (p.length < 8) return setErr("Passwords need 8 or more characters.");
    if (code.trim().toUpperCase() !== "LUNAR") return setErr("That join code isn't right. Ask the owner for it.");
    if (users()[u.trim()]) return setErr("That username is taken.");
    try { localStorage.setItem("lunar-users", JSON.stringify({ ...JSON.parse(localStorage.getItem("lunar-users") || "{}"), [u.trim()]: p })); } catch { /* ignore */ }
    enter(u.trim());
  };
  const label = "text-xs font-mono font-medium uppercase tracking-[0.08em] text-muted-foreground";
  const input = "mt-1 w-full border-b-2 border-border bg-transparent py-2 text-lg outline-none focus:border-primary";
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className={`a-arrive lockcard w-full max-w-[400px] border border-primary bg-card shadow-[6px_6px_0_var(--border)] ${out ? "out" : ""}`}>
        <div className="flex flex-col items-center border-b border-primary bg-secondary px-8 py-10">
          <Logo big />
          <p className="mt-4 font-serif italic text-accent">French pastry, Taiwanese soul.</p>
        </div>
        <div key={mode} className="a-fade space-y-5 p-8">
          <h1 className="font-serif text-2xl text-foreground">{mode === "in" ? "Orders dashboard" : "Create a login"}</h1>
          <label className="block"><span className={label}>{mode === "in" ? "Username" : "Choose a username"}</span><input autoComplete="username" value={u} onChange={(e) => { setU(e.target.value); setErr(""); }} className={input} /></label>
          <label className="block"><span className={label}>{mode === "in" ? "Password" : "Choose a password, 8 or more characters"}</span>
            <div className="flex items-end gap-3"><input autoComplete={mode === "in" ? "current-password" : "new-password"} type={show ? "text" : "password"} value={p} onChange={(e) => { setP(e.target.value); setErr(""); }} className={input} /><button type="button" onClick={() => setShow(!show)} className="press pb-2 text-sm text-muted-foreground underline">{show ? "Hide" : "Show"}</button></div>
          </label>
          {mode === "up" && <label className="block"><span className={label}>Join code from the owner</span><input value={code} onChange={(e) => setCode(e.target.value)} className={input} /></label>}
          {err && <p key={err} className="a-rise text-sm text-destructive">{err}</p>}
          <button className="press w-full bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90">{mode === "in" ? "Sign in" : "Create login"}</button>
          {mode === "in" ? (
            <>
              <p className="text-sm text-muted-foreground">New here? <button type="button" onClick={() => { setMode("up"); setErr(""); }} className="press text-foreground underline">Create a login</button></p>
              <p className="border-t border-border pt-4 text-sm text-muted-foreground">Demo login: <span className="code-chip">admin</span> and <span className="code-chip">lunar123</span></p>
            </>
          ) : (
            <button type="button" onClick={() => { setMode("in"); setErr(""); }} className="press text-sm text-foreground underline">Back to sign in</button>
          )}
        </div>
      </form>
    </main>
  );
}

const TABS = ["Week", "History", "Products"] as const;
type Tab = (typeof TABS)[number];
function Dashboard({ onLogout }: { onLogout: () => void }) {
  const s = useStore();
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
  useLayoutEffect(place, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
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

  // A new online order from the order page lands here live.
  useEffect(() => onArrive((ids) => {
    const got = getState().orders.filter((x) => ids.includes(x.id) && x.pending);
    if (got.length === 1) toast(`New online order: ${got[0]!.name}, ${parse(got[0]!.date).toLocaleDateString("en-US", { weekday: "short" })} ${fmtTime(got[0]!.time)}`);
    else if (got.length > 1) toast(`${got.length} new online orders`);
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const waiting = s.orders.filter((o) => o.pending).length;
  useEffect(() => { document.title = waiting ? `(${waiting}) Lunar Orders` : "Orders Dashboard · Lunar Bakery"; }, [waiting]);

  return (
    <div className="a-arrive min-h-screen bg-background px-5 pb-12">
      <header className="flex flex-wrap items-center gap-x-10 gap-y-3 py-4">
        <Logo />
        <nav ref={nav} className="relative flex gap-2">
          {TABS.map((t) => (
            <button key={t} data-t={t} onClick={() => switchTab(t)} aria-pressed={tab === t}
              className={`relative px-3 py-2 font-semibold ${tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {t}{t === "Week" && waiting > 0 && <span className="a-chip ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs text-accent-foreground">{waiting}</span>}
            </button>
          ))}
          <span className="tabbar" style={{ width: bar.w - 24, transform: `translateX(${bar.x + 12}px)` }} />
        </nav>
        <div className="ml-auto flex items-center gap-6 font-semibold text-foreground">
          <SyncBadge />
          <a href="/" target="_blank" rel="noreferrer" className="press hidden text-sm underline-offset-4 hover:underline md:inline">Website</a>
          <a href="/order" target="_blank" rel="noreferrer" className="press rounded-full border-2 border-primary px-4 py-1.5 text-sm hover:bg-primary hover:text-primary-foreground">Open order page</a>
          <button onClick={() => setNumbers(true)} className={`press transition-opacity ${tab === "Week" ? "" : "pointer-events-none opacity-0"}`} tabIndex={tab === "Week" ? 0 : -1}>Week numbers</button>
          <button onClick={onLogout} className="press">Sign out</button>
        </div>
      </header>
      <div className={leaving ? "tab-out" : ""}>
        <div key={shown} className={`tab-in ${shown === "Week" ? "" : "pt-8"}`}>
          {shown === "Week" && <WeekView numbersOpen={numbers} setNumbersOpen={setNumbers} />}
          {shown === "History" && <HistoryView />}
          {shown === "Products" && <ProductsView />}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
