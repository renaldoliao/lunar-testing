import pg from "pg";
import { applyOp, type Op } from "@/lib/ops";
import { seed, type State } from "@/lib/store";

/*
 * The shop's shared data, kept as one row in Postgres.
 * Each change locks the row, applies the change and saves, so two devices
 * changing things at the same moment can never overwrite each other.
 * The table is created the first time the site runs.
 */
let pool: pg.Pool | null = null;
let ready: Promise<void> | null = null;

export const dbEnabled = () => !!process.env["DATABASE_URL"];

function getPool() {
  if (!pool) {
    const url = process.env["DATABASE_URL"]!;
    const local = /localhost|127\.0\.0\.1/.test(url);
    pool = new pg.Pool({ connectionString: url, max: 3, ssl: local || /sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: false } });
  }
  return pool;
}
function setup() {
  if (!ready) ready = (async () => {
    const db = getPool();
    await db.query(`CREATE TABLE IF NOT EXISTS lunar_store (id int PRIMARY KEY, version bigint NOT NULL, state jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`);
    await db.query(`INSERT INTO lunar_store (id, version, state) VALUES (1, 1, $1) ON CONFLICT (id) DO NOTHING`, [JSON.stringify(seed())]);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

export async function readStore(): Promise<{ state: State; version: number }> {
  await setup();
  const r = await getPool().query(`SELECT version, state FROM lunar_store WHERE id = 1`);
  return { version: Number(r.rows[0].version), state: r.rows[0].state as State };
}
export async function readVersion(): Promise<number> {
  await setup();
  const r = await getPool().query(`SELECT version FROM lunar_store WHERE id = 1`);
  return Number(r.rows[0].version);
}
export async function writeOp(op: Op): Promise<{ state: State; version: number; error?: string }> {
  await setup();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(`SELECT version, state FROM lunar_store WHERE id = 1 FOR UPDATE`);
    const cur = { version: Number(r.rows[0].version), state: r.rows[0].state as State };
    const res = applyOp(cur.state, op);
    if ("error" in res) { await client.query("ROLLBACK"); return { ...cur, error: res.error }; }
    const version = cur.version + 1;
    await client.query(`UPDATE lunar_store SET version = $1, state = $2, updated_at = now() WHERE id = 1`, [version, JSON.stringify(res.state)]);
    await client.query("COMMIT");
    return { state: res.state, version };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
