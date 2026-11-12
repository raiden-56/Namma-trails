"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { endpoints, type Me } from "@/lib/api/endpoints";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Dialog";
import { Avatar } from "@/components/ui/Display";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorState } from "@/components/ui/States";
import { cn } from "@/lib/cn";

export const ME_QUERY_KEY = ["auth", "me"] as const;

export function useMe() {
  return useQuery({ queryKey: ME_QUERY_KEY, queryFn: endpoints.me, staleTime: 5 * 60_000 });
}

const isUnauthenticated = (error: unknown) => error instanceof ApiError && error.status === 401;

/**
 * Client-side gate for portal screens. A UX layer only: the API authorises
 * every request, so bypassing this component reveals nothing.
 */
export function SessionGate({
  allow,
  denied,
  signInQuery = "",
  children,
}: {
  /** Whether the signed-in user may see this area. */
  allow: (me: Me) => boolean;
  /** Shown to signed-in users who are not allowed. */
  denied: ReactNode;
  /** Extra query for the sign-in page, e.g. "as=partner&". */
  signInQuery?: string;
  children: ReactNode;
}) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (me.isError && isUnauthenticated(me.error)) router.replace(`/sign-in?${signInQuery}next=${encodeURIComponent(pathname)}`);
  }, [me.isError, me.error, router, pathname, signInQuery]);

  if (me.isPending || (me.isError && isUnauthenticated(me.error))) {
    return (
      <div className="flex items-center gap-3 p-6 text-sm text-fg-muted">
        <Spinner /> Checking your access…
      </div>
    );
  }
  if (me.isError) return <ErrorState title="We couldn't load your account" description={me.error.message} />;
  if (!allow(me.data)) return <>{denied}</>;
  return <>{children}</>;
}

/** Where a signed-in user's "home" is: admin console, partner portal or their trips. */
function homeFor(me: Me): { href: string; label: string } {
  if (me.permissions.includes("admin.dashboard.view")) return { href: "/admin", label: "Admin" };
  if (me.providers.length > 0) return { href: "/partner", label: "Partner portal" };
  return { href: "/trips", label: "My trips" };
}

/** What the signed-in person is, in words: admin roles first, then their partner role, else traveller. */
function roleLabels(me: Me): string[] {
  const admin = me.roles.filter((r) => r !== "traveler");
  if (admin.length > 0) return admin.map((r) => r.replace(/_/g, " "));
  const provider = me.providers[0];
  if (provider) return [provider.role.replace(/_/g, " ")];
  return ["traveller"];
}

/** Phone-sized account control: the avatar alone. It opens the profile sheet. */
function ProfileTrigger({ name, open, onOpen, className }: { name: string; open: boolean; onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-label="Open your profile"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={onOpen}
      className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-200 hover:bg-fg/8", className)}
      data-testid="profile-trigger"
    >
      <Avatar name={name} size="sm" />
    </button>
  );
}

/** The profile section behind the avatar: who is signed in, their role, a way home and sign out. */
function ProfileSheet({
  me,
  roles,
  open,
  onClose,
  onSignOut,
}: {
  me: Me;
  roles: string[];
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const name = me.fullName ?? me.email ?? me.phone ?? "Account";
  const contact = me.email ?? me.phone;
  const home = homeFor(me);
  // Name and email head the sheet; the rows below add what is left.
  const rows: Array<[string, ReactNode]> = [];
  if (me.email && me.phone) rows.push(["Mobile", me.phone]);
  rows.push([
    roles.length === 1 ? "Role" : "Roles",
    <span key="roles" className="flex flex-wrap justify-end gap-1.5">
      {roles.map((role) => (
        <Badge key={role} tone="info">
          {role}
        </Badge>
      ))}
    </span>,
  ]);

  return (
    <Sheet open={open} onClose={onClose} title="Your profile" placement="bottom">
      <div className="flex flex-col gap-5" data-testid="profile-sheet">
        <div className="flex items-center gap-4">
          <Avatar name={name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold leading-tight">{name}</p>
            {contact && contact !== name ? <p className="truncate text-sm text-fg-muted">{contact}</p> : null}
          </div>
        </div>
        <dl className="flex flex-col divide-y divide-line border-y border-line text-[0.9375rem]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-3">
              <dt className="shrink-0 text-fg-muted">{label}</dt>
              <dd className="min-w-0 break-words text-right font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-col gap-3">
          <Button href={home.href} variant="secondary" size="lg" className="w-full">
            {home.label}
          </Button>
          <Button variant="strong" size="lg" className="w-full" leadingIcon={<LogOut className="size-4" />} onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * Header account control: "Sign in" when signed out. When signed in, phones show only
 * the avatar, which opens the profile sheet (name, email, role, sign out); from sm up
 * the name, home link and sign out sit in the bar as before.
 */
export function AccountButton({ variant = "strong" }: { variant?: "strong" | "secondary" }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => setProfileOpen(false), [pathname]);

  if (me.isPending) return <span className="inline-block h-9 w-20" aria-hidden="true" />;
  if (!me.data) {
    return (
      <Button href="/sign-in" variant={variant} size="sm">
        Sign in
      </Button>
    );
  }
  const name = me.data.fullName?.split(" ")[0] ?? "Account";
  const home = homeFor(me.data);

  async function signOut() {
    setProfileOpen(false);
    await endpoints.signOut().catch(() => undefined);
    queryClient.clear();
    router.replace("/");
  }

  return (
    <>
      <span className="flex items-center gap-1.5" data-testid="account-button">
        <ProfileTrigger name={me.data.fullName ?? name} open={profileOpen} onOpen={() => setProfileOpen(true)} className="sm:hidden" />
        <span className="hidden items-center gap-1.5 sm:flex">
          {/* Between xl and 2xl the bar also holds every nav link, so the pill shows the name alone. */}
          <Button
            href={home.href}
            variant={variant}
            size="sm"
            aria-label={`${home.label} (${name})`}
            leadingIcon={<Avatar name={me.data.fullName ?? name} size="sm" />}
          >
            <span className="inline-flex max-w-40 items-baseline">
              <span className="truncate">{name}</span>
              <span className="whitespace-pre xl:hidden 2xl:inline"> · {home.label}</span>
            </span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void signOut()} aria-label="Sign out">
            <LogOut className="size-4" aria-hidden="true" />
          </Button>
        </span>
      </span>
      <ProfileSheet me={me.data} roles={roleLabels(me.data)} open={profileOpen} onClose={() => setProfileOpen(false)} onSignOut={() => void signOut()} />
    </>
  );
}

/**
 * Signed-in identity, role badges and sign out, for portal top bars. Phones show only
 * the avatar, which opens the same profile sheet.
 */
export function PortalIdentity({ badges }: { badges: (me: Me) => string[] }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => setProfileOpen(false), [pathname]);

  if (!me.data) return null;
  const name = me.data.fullName ?? me.data.email ?? me.data.phone ?? "Account";
  const roles = badges(me.data);

  async function signOut() {
    setProfileOpen(false);
    await endpoints.signOut().catch(() => undefined);
    queryClient.clear();
    router.replace("/sign-in");
  }

  return (
    <>
      <ProfileTrigger name={name} open={profileOpen} onOpen={() => setProfileOpen(true)} className="sm:hidden" />
      <div className="hidden items-center gap-3 sm:flex" data-testid="portal-identity">
        <div className="text-right">
          <p className="text-sm font-semibold leading-tight">{name}</p>
          <p className="text-xs text-fg-muted">{me.data.email ?? me.data.phone}</p>
        </div>
        {roles.map((b) => (
          <Badge key={b} tone="info">
            {b}
          </Badge>
        ))}
        <Avatar name={name} size="sm" />
        <Button variant="ghost" size="sm" leadingIcon={<LogOut className="size-4" />} onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
      <ProfileSheet
        me={me.data}
        roles={roles.length > 0 ? roles : roleLabels(me.data)}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSignOut={() => void signOut()}
      />
    </>
  );
}
