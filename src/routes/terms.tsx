import { createFileRoute } from "@tanstack/react-router";
import { Legal } from "@/components/site/Legal";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms · Lunar Bakery" }, { name: "description", content: "Terms for ordering from Lunar Bakery." }] }),
  component: () => (
    <Legal title="Terms">
      <h2>Ordering</h2>
      <p>An online order is a request until Lunar confirms it by text or phone. We bake to order, so a day can fill up or close early.</p>
      <h2>Payment</h2>
      <p>You pay when you collect. Prices are the ones shown when you placed the order.</p>
      <h2>Changes and pickup</h2>
      <p>To change or cancel, call the shop at least a day before pickup. Orders not collected by closing time may be given away.</p>
      <h2>Allergens</h2>
      <p>Our pastries contain wheat, dairy and eggs and are made in a kitchen that handles nuts.</p>
    </Legal>
  ),
});
