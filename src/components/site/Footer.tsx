const MAP = "https://maps.google.com/?q=2948+Folsom+St,+San+Francisco,+CA+94110";
const IG = "https://www.instagram.com/lunarbakerysf/";

export function Footer({ compact }: { compact?: boolean }) {
  const year = new Date().getFullYear();
  const link = "text-sm text-primary-foreground/70 hover:text-primary-foreground";
  return (
    <footer className={`w-full bg-primary px-6 text-primary-foreground ${compact ? "py-10" : "py-14"}`}>
      <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-12 md:flex-row">
        <div className="flex flex-col">
          <img src="/images/lunar-logo-white.png" alt="Lunar Artisan Baked Goods" className="mb-5 h-auto w-36" />
          <p className="mb-1 font-serif text-sm italic text-primary-foreground/70">French pastry, Taiwanese soul.</p>
          <p className="font-mono text-xs uppercase tracking-[0.1em] text-primary-foreground/50">San Francisco · Est. 2020</p>
        </div>
        <div className="flex flex-col gap-10 sm:flex-row sm:gap-16">
          <div className="flex flex-col gap-3">
            <h4 className="mb-1 text-xs font-mono font-medium uppercase tracking-[0.08em] text-primary-foreground/50">Order</h4>
            <a href="/order" className={link}>Order for pickup</a>
            <a href="mailto:lunarbakerysf@gmail.com?subject=Custom%20cake" className={link}>Custom cakes</a>
            <a href="mailto:lunarbakerysf@gmail.com?subject=Catering" className={link}>Catering</a>
          </div>
          <div className="flex flex-col gap-3">
            <h4 className="mb-1 text-xs font-mono font-medium uppercase tracking-[0.08em] text-primary-foreground/50">Connect</h4>
            <a href={IG} target="_blank" rel="noopener noreferrer" className={link}>Instagram</a>
            <a href="mailto:lunarbakerysf@gmail.com" className={link}>Email us</a>
          </div>
          <div className="flex flex-col gap-3">
            <h4 className="mb-1 text-xs font-mono font-medium uppercase tracking-[0.08em] text-primary-foreground/50">Visit</h4>
            <a href={MAP} target="_blank" rel="noopener noreferrer" className={link}>2948 Folsom St, SF</a>
            <span className="text-sm text-primary-foreground/70">Pop-up only</span>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-[1200px] flex-col items-center justify-between gap-3 border-t border-primary-foreground/10 pt-6 text-xs text-primary-foreground/40 sm:flex-row">
        <span>© {year} Lunar Bakery</span>
        <span className="flex gap-5">
          <a href="/terms" className="hover:text-primary-foreground">Terms</a>
          <a href="/privacy" className="hover:text-primary-foreground">Privacy</a>
          <a href="/dashboard" className="hover:text-primary-foreground">Staff</a>
        </span>
      </div>
    </footer>
  );
}
