import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ChatBubble } from "./ChatBubble";

export function Legal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="a-arrive mx-auto w-full max-w-[62ch] flex-1 px-6 pb-24 pt-16">
        <h1 className="font-serif text-[56px] leading-[0.95] tracking-[-0.02em] text-foreground">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Demo text. Replace with the bakery's own wording before going live.</p>
        <div className="mt-10 space-y-5 text-lg leading-[1.45] text-foreground [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl">{children}</div>
        <a href="/order" className="press mt-12 inline-block bg-primary px-8 py-3 text-sm font-mono font-medium uppercase tracking-[0.08em] text-primary-foreground hover:bg-primary/90">Order for pickup</a>
      </main>
      <Footer compact />
      <ChatBubble />
    </div>
  );
}
