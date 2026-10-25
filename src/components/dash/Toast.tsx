import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// One small message at the bottom left. Call toast("Saved") from anywhere.
let push: ((m: string) => void) | null = null;
export const toast = (m: string) => push?.(m);

export function Toaster() {
  const [msg, setMsg] = useState<{ text: string; key: number } | null>(null);
  useEffect(() => {
    push = (text) => setMsg({ text, key: Date.now() });
    return () => { push = null; };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg || typeof document === "undefined") return null;
  return createPortal(
    <div key={msg.key} role="status" className="a-rise pointer-events-none fixed bottom-5 left-4 right-4 z-50 bg-primary px-4 py-3 font-semibold text-primary-foreground sm:right-auto sm:max-w-sm">
      {msg.text}
    </div>,
    document.body,
  );
}
