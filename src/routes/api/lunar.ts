import { createFileRoute } from "@tanstack/react-router";
import { isOp } from "@/lib/ops";

// The bakery's side. Every request must carry the staff password, so customers'
// names and phone numbers are never visible to the public.
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const staffOk = (request: Request) => {
  const want = process.env["LUNAR_STAFF_KEY"] || "lunar123";
  return request.headers.get("x-lunar-key") === want;
};

export const Route = createFileRoute("/api/lunar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const db = await import("@/server/db");
        if (!db.dbEnabled()) return json({ enabled: false });
        if (!staffOk(request)) return json({ error: "Wrong staff password." }, 401);
        try {
          const since = Number(new URL(request.url).searchParams.get("v") || 0);
          if (since === -1) return json({ enabled: true, ok: true }); // password check only
          if (since && (await db.readVersion()) === since) return json({ enabled: true, same: true });
          return json({ enabled: true, ...(await db.readStore()) });
        } catch (e) {
          console.error("lunar read failed", e);
          return json({ enabled: true, error: "Could not reach the database." }, 503);
        }
      },
      POST: async ({ request }) => {
        const db = await import("@/server/db");
        if (!db.dbEnabled()) return json({ enabled: false, error: "No database connected." }, 400);
        if (!staffOk(request)) return json({ error: "Wrong staff password." }, 401);
        const text = await request.text();
        if (text.length > 3_000_000) return json({ error: "That change is too large." }, 413);
        let body: unknown;
        try { body = JSON.parse(text); } catch { return json({ error: "Could not read that change." }, 400); }
        const op = (body as { op?: unknown })?.op;
        if (!isOp(op)) return json({ error: "Could not read that change." }, 400);
        try {
          return json({ enabled: true, ...(await db.writeOp(op)) });
        } catch (e) {
          console.error("lunar write failed", e);
          return json({ error: "Could not save. Please try again." }, 503);
        }
      },
    },
  },
});
