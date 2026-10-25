import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Side sheet. Slides in, and slides back out before it disappears.
export function Drawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const [shown, setShown] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const last = useRef<ReactNode>(children);
  if (open) last.current = children;

  useEffect(() => {
    if (open) { setShown(true); setLeaving(false); return; }
    if (!shown) return;
    setLeaving(true);
    const t = setTimeout(() => { setShown(false); setLeaving(false); }, 180);
    return () => clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!shown || typeof document === "undefined") return null;
  // Rendered straight into <body> so page animations never trap it inside a smaller box.
  return createPortal(
    <div className={`fixed inset-0 z-40 ${leaving ? "pointer-events-none" : ""}`}>
      <div className={`scrim absolute inset-0 bg-primary/45 ${leaving ? "out" : ""}`} onClick={onClose} />
      <aside role="dialog" aria-modal="true" className={`sheet absolute right-0 top-0 h-full w-full max-w-[440px] overflow-y-auto border-l-2 border-primary bg-card px-6 py-6 ${leaving ? "out" : ""}`}>
        <button onClick={onClose} className="press absolute right-4 top-4 px-2 py-1 text-sm text-muted-foreground hover:text-foreground">Close</button>
        {open ? children : last.current}
      </aside>
    </div>,
    document.body,
  );
}
