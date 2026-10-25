import type { ReactNode } from "react";

export function Legal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-5 py-5 sm:px-10">
      <a href="/order" className="inline-block leading-none">
        <div className="font-sans text-2xl font-bold tracking-[0.12em] text-brand-blue">LUNAR</div>
        <div className="mt-1 text-[9px] tracking-[0.22em] text-accent">ARTISAN BAKED GOODS</div>
      </a>
      <main className="a-arrive mx-auto mt-16 max-w-[62ch] pb-20">
        <h1 className="font-serif text-[56px] leading-[0.95] tracking-[-0.02em] text-foreground">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Demo text. Replace with the bakery's own wording before going live.</p>
        <div className="mt-10 space-y-5 text-lg leading-[1.45] text-foreground [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl">{children}</div>
        <a href="/order" className="press mt-12 inline-block rounded-full border-2 border-primary px-5 py-2 font-bold text-foreground hover:bg-primary hover:text-primary-foreground">Back to ordering</a>
      </main>
    </div>
  );
}
