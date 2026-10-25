import { useEffect, useState } from "react";

// Website header, shared by the homepage, the order page and the legal pages.
const NAV = [
  { label: "Menu", hash: "menu" },
  { label: "Our Story", hash: "story" },
  { label: "Visit", hash: "visit" },
];

export function Header({ onOrderPage }: { onOrderPage?: boolean }) {
  const [open, setOpen] = useState(false);
  const onHome = typeof window !== "undefined" && window.location.pathname === "/";
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  const go = (e: React.MouseEvent, hash: string) => {
    setOpen(false);
    if (!onHome) return; // on other pages the link takes you home to that section
    e.preventDefault();
    document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
    history.replaceState(null, "", `#${hash}`);
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/60 bg-background">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6">
        <a href="/" className="hidden w-40 shrink-0 md:block" aria-label="Lunar Bakery home">
          <img src="/images/lunar-logo.png" alt="Lunar Artisan Baked Goods" className="h-auto w-full mix-blend-multiply" />
        </a>
        <nav className="hidden items-center gap-10 md:flex">
          {NAV.map((n) => (
            <a key={n.hash} href={`/#${n.hash}`} onClick={(e) => go(e, n.hash)} className="font-mono text-xs uppercase tracking-[0.1em] text-primary/70 hover:text-primary">{n.label}</a>
          ))}
        </nav>
        <a href="/order" aria-current={onOrderPage ? "page" : undefined}
          className={`press hidden px-5 py-3 text-xs font-mono font-medium uppercase tracking-[0.08em] md:inline-block ${onOrderPage ? "border border-primary text-primary" : "bg-accent text-accent-foreground hover:bg-accent/90"}`}>
          {onOrderPage ? "Ordering" : "Order now »"}
        </a>

        <div className="relative flex w-full items-center justify-between md:hidden">
          <button onClick={() => setOpen((o) => !o)} className="press flex h-10 w-10 flex-col items-start justify-center gap-[5px]" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
            <span className={`block h-[2px] w-6 bg-primary transition-transform duration-300 ${open ? "translate-y-[7px] rotate-45" : ""}`} />
            <span className={`block h-[2px] w-6 bg-primary transition-opacity duration-200 ${open ? "opacity-0" : ""}`} />
            <span className={`block h-[2px] w-6 bg-primary transition-transform duration-300 ${open ? "-translate-y-[7px] -rotate-45" : ""}`} />
          </button>
          <a href="/" className="absolute left-1/2 w-28 -translate-x-1/2" aria-label="Lunar Bakery home">
            <img src="/images/lunar-logo.png" alt="Lunar Artisan Baked Goods" className="h-auto w-full mix-blend-multiply" />
          </a>
          {!onOrderPage && <a href="/order" className="press bg-accent px-4 py-2 text-[11px] font-mono font-medium uppercase tracking-[0.08em] text-accent-foreground">Order »</a>}
        </div>
      </div>
      {open && (
        <div className="a-rise flex flex-col gap-5 border-t border-border/60 bg-background px-6 py-6 md:hidden">
          {NAV.map((n) => (
            <a key={n.hash} href={`/#${n.hash}`} onClick={(e) => go(e, n.hash)} className="font-mono text-sm uppercase tracking-[0.1em] text-primary/80">{n.label}</a>
          ))}
          <a href="/order" className="text-sm font-mono font-medium uppercase tracking-[0.08em] text-primary">Order for pickup</a>
        </div>
      )}
    </header>
  );
}
