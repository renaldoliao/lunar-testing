import { describe, expect, it } from "vitest";
import { applyOp } from "@/lib/ops";
import { seed, type Order } from "@/lib/store";

const online = (date: string, qty = 1): Order => ({ id: Math.random().toString(36).slice(2), date, time: 660, name: "Test", phone: "4155550100", items: [{ code: "nx24", qty }], note: "", source: "online", text: false, pending: true });

describe("shop changes", () => {
  it("refuses online orders on a closed day", () => {
    const s = { ...seed(), closed: { "2030-01-07": true } };
    expect(applyOp(s, { t: "add", order: online("2030-01-07") })).toHaveProperty("error");
  });
  it("refuses online orders that go over the daily limit", () => {
    expect(applyOp(seed(), { t: "add", order: online("2030-01-07", 17) })).toHaveProperty("error"); // 17 x 24 = 408
    expect(applyOp(seed(), { t: "add", order: online("2030-01-07", 16) })).toHaveProperty("state"); // 384
  });
  it("adds the same order only once when it is sent twice", () => {
    const o = online("2030-01-07");
    const a = applyOp(seed(), { t: "add", order: o });
    if (!("state" in a)) throw new Error("expected state");
    const b = applyOp(a.state, { t: "add", order: o });
    if (!("state" in b)) throw new Error("expected state");
    expect(b.state.orders.filter((x) => x.id === o.id)).toHaveLength(1);
  });
});
