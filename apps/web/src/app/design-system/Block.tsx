import type { ReactNode } from "react";

export function Block({ id, title, children, note }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6 border-t border-line py-12">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-display text-display-sm">
          {title}
        </h2>
        {note ? <p className="max-w-3xl text-sm text-fg-muted">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}
