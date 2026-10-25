import { createFileRoute } from "@tanstack/react-router";
import { Legal } from "@/components/site/Legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy · Lunar Bakery" }, { name: "description", content: "How Lunar Bakery uses the details you give when ordering." }] }),
  component: () => (
    <Legal title="Privacy">
      <h2>What we keep</h2>
      <p>Your name, phone number, what you ordered, your pickup time and any note you leave.</p>
      <h2>Why</h2>
      <p>To bake your order, confirm it, remind you on pickup day if you asked us to, and recognise regulars.</p>
      <h2>Who sees it</h2>
      <p>Only the Lunar team. We do not sell or share your details. Ask us any time and we will delete them.</p>
    </Legal>
  ),
});
