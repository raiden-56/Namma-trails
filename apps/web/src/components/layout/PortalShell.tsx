"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { adminNav, partnerNav, PENDING_HINT } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Dialog";
import { Wordmark } from "./Wordmark";

/**
 * Shared shell for the partner portal (density "comfortable") and the super-admin
 * dashboard (density "compact"). Sidebar on desktop, drawer on mobile.
 */
// Nav config holds icon components, which cannot cross the server→client boundary as props,
// so the shell selects its nav by key.
const navs = { partner: partnerNav, admin: adminNav } as const;

export function PortalShell({
  title,
  section,
  density,
  homeHref,
  topbar,
  children,
}: {
  title: string;
  section: keyof typeof navs;
  density: "comfortable" | "compact";
  homeHref: string;
  topbar?: ReactNode;
  children: ReactNode;
}) {
  const nav = navs[section];
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const navList = (
    <ul className="flex flex-col gap-0.5">
      {nav.map((item) => {
        const Icon = item.icon;
        const active = item.href === homeHref ? pathname === homeHref : pathname.startsWith(item.href);
        const row = cn(
          "flex w-full items-center gap-3 rounded-md px-3 font-semibold",
          density === "compact" ? "py-1.5 text-[0.8125rem]" : "py-2.5 text-sm",
        );
        return (
          <li key={item.href}>
            {item.pending ? (
              <span className={cn(row, "cursor-not-allowed text-fg-subtle")} aria-disabled="true" title={item.pendingReason ?? PENDING_HINT}>
                {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
                <span className="flex-1 truncate">{item.label}</span>
                <span className="sr-only">({item.pendingReason ?? PENDING_HINT})</span>
                <span aria-hidden="true" className="rounded-full bg-fg/8 px-1.5 py-0.5 text-[0.625rem] font-semibold">
                  {item.pendingTag ?? "Soon"}
                </span>
              </span>
            ) : (
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(row, active ? "bg-fg text-surface" : "text-fg-muted hover:bg-fg/6 hover:text-fg")}
              >
                {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
                <span className="truncate">{item.label}</span>
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex min-h-dvh bg-surface">
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col gap-6 border-r border-line bg-surface-raised p-4 lg:flex", density === "compact" ? "w-60" : "w-64")}>
        <div className="flex flex-col gap-1 px-2 pt-1">
          <Wordmark className="text-xl" />
          <span className="text-xs font-semibold text-fg-muted">{title}</span>
        </div>
        <nav aria-label={title}>{navList}</nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={cn("sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:px-8", density === "compact" ? "h-14" : "h-16")}>
          <IconButton label="Open navigation" icon={<Menu className="size-5" />} className="lg:hidden" onClick={() => setOpen(true)} aria-expanded={open} />
          <span className="text-sm font-semibold lg:hidden">{title}</span>
          <div className="ml-auto flex items-center gap-2">{topbar}</div>
        </header>
        <main id="main" className={cn("flex-1", density === "compact" ? "p-4 lg:p-6" : "p-4 sm:p-6 lg:p-10")}>
          {children}
        </main>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title={title} placement="left">
        <nav aria-label={title}>{navList}</nav>
      </Sheet>
    </div>
  );
}
