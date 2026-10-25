import { createFileRoute } from "@tanstack/react-router";
import { applyCustomer, isCOp, mineView, publicView } from "@/lib/shop";

// The customer's side. Anyone can read the menu and open days. Orders and messages are
// only returned to the device that holds their private key.
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
type Keys = { id: string; token: string }[];
const keys = (v: unknown): Keys => (Array.isArray(v) ? v.slice(0, 40).filter((k) => k && typeof k.id === "string" && typeof k.token === "string") : []);

export const Route = createFileRoute("/api/shop")({
  server: {
    handlers: {
      GET: async () => {
        const db = await import("@/server/db");
        if (!db.dbEnabled()) return json({ enabled: false });
        try {
          const { state, version } = await db.readStore();
          return json({ enabled: true, version, view: publicView(state) });
        } catch (e) {
          console.error("shop read failed", e);
          return json({ enabled: true, error: "Could not reach the bakery right now." }, 503);
        }
      },
      POST: async ({ request }) => {
        const db = await import("@/server/db");
        if (!db.dbEnabled()) return json({ enabled: false, error: "Ordering is not connected yet." }, 400);
        const text = await request.text();
        if (text.length > 100_000) return json({ error: "That is too large." }, 413);
        let body: { cop?: unknown; mine?: { orders?: unknown; threads?: unknown } };
        try { body = JSON.parse(text); } catch { return json({ error: "Could not read that." }, 400); }
        try {
          if (body.mine) {
            const { state } = await db.readStore();
            return json(mineView(state, { orders: keys(body.mine.orders), threads: keys(body.mine.threads) }));
          }
          if (!isCOp(body.cop)) return json({ error: "Could not read that." }, 400);
          const cop = body.cop;
          const res = await db.mutate((s) => applyCustomer(s, cop, Date.now()));
          return json(res.error ? { error: res.error, view: publicView(res.state) } : { ok: true, view: publicView(res.state) });
        } catch (e) {
          console.error("shop write failed", e);
          return json({ error: "Could not reach the bakery. Please try again." }, 503);
        }
      },
    },
  },
});
