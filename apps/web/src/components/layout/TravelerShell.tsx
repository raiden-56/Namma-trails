"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { travelerNav } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { AccountButton } from "@/features/auth/session";
import { Wordmark } from "./Wordmark";

/** Traveller app shell: clear, booking-focused. Top bar on desktop, bottom tab bar on mobile. */
export function TravelerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="container-editorial flex h-16 items-center justify-between gap-4">
          <Wordmark />
          <nav aria-label="Traveller" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {travelerNav.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn("rounded-full px-4 py-2 text-sm font-semibold", active ? "bg-fg text-surface" : "text-fg-muted hover:text-fg")}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <AccountButton variant="secondary" />
        </div>
      </header>
      <main id="main" className="container-editorial flex-1 pb-28 pt-8 md:pb-16">
        {children}
      </main>
      <nav aria-label="Traveller" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-4">
          {travelerNav.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-semibold", active ? "text-accent-text" : "text-fg-muted")}
                >
                  {Icon ? <Icon className="size-5" aria-hidden="true" /> : null}
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
