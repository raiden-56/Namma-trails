"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { endpoints, type AdminUser, type AdminUsersQuery } from "@/lib/api/endpoints";
import { Badge, StatusChip } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Choice";
import { Avatar } from "@/components/ui/Display";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Pagination } from "@/components/ui/Navigation";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table } from "@/components/ui/Table";

const PAGE_SIZE = 20;

interface Filters {
  q: string;
  role: string;
  partnersOnly: boolean;
}

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "super_admin", label: "Super admin" },
  { value: "operations_admin", label: "Operations admin" },
  { value: "verification_admin", label: "Verification admin" },
  { value: "finance_admin", label: "Finance admin" },
  { value: "support_admin", label: "Support admin" },
  { value: "traveler", label: "Traveller" },
];

const USER_STATUS: Record<AdminUser["status"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  active: { label: "Active", tone: "success" },
  pending_verification: { label: "Pending verification", tone: "warning" },
  suspended: { label: "Suspended", tone: "danger" },
  deleted: { label: "Deleted", tone: "neutral" },
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";

export function UsersAdmin() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const query: AdminUsersQuery = {
    q: params.get("q") ?? undefined,
    role: params.get("role") ?? undefined,
    partnersOnly: params.get("partnersOnly") === "true" ? "true" : undefined,
    page: Math.max(1, Number(params.get("page") ?? 1) || 1),
    pageSize: PAGE_SIZE,
  };
  /*
   * Applied filters live in a ref that updates synchronously, and every URL is built from it.
   * router.replace() updates the address bar asynchronously, so reading the URL (or render-time
   * params) between two quick changes would resurrect a value the first change had cleared.
   */
  const applied = useRef<Filters>({ q: query.q ?? "", role: query.role ?? "", partnersOnly: query.partnersOnly === "true" });
  const [search, setSearch] = useState(applied.current.q);
  const [role, setRole] = useState(applied.current.role);
  const [partnersOnly, setPartnersOnly] = useState(applied.current.partnersOnly);

  // Back/forward navigation: pull the controls and the applied filters back in line with the URL.
  useEffect(() => {
    const onPopState = () => {
      const current = new URLSearchParams(window.location.search);
      applied.current = { q: current.get("q") ?? "", role: current.get("role") ?? "", partnersOnly: current.get("partnersOnly") === "true" };
      setSearch(applied.current.q);
      setRole(applied.current.role);
      setPartnersOnly(applied.current.partnersOnly);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const users = useQuery({
    queryKey: ["admin", "users", query],
    queryFn: () => endpoints.adminUsers(query),
    placeholderData: keepPreviousData,
  });

  function hrefFor(filters: Filters, page = 1) {
    const next = new URLSearchParams();
    if (filters.q) next.set("q", filters.q);
    if (filters.role) next.set("role", filters.role);
    if (filters.partnersOnly) next.set("partnersOnly", "true");
    if (page > 1) next.set("page", String(page));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  /** Applies a filter change and resets to page 1. */
  function apply(changes: Partial<Filters>) {
    applied.current = { ...applied.current, ...changes };
    router.replace(hrefFor(applied.current));
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    apply({ q: search.trim() });
  }

  const total = users.data?.meta.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-fg-muted">Travellers, partners and administrators registered on the platform.</p>
        </div>
        <p className="text-sm text-fg-muted" data-testid="users-total" aria-live="polite">
          {users.data ? `${total} user${total === 1 ? "" : "s"}` : null}
        </p>
      </div>

      <form onSubmit={onSearch} className="grid gap-3 rounded-lg border border-line bg-surface-raised p-3 md:grid-cols-[1fr_14rem_auto_auto] md:items-end" role="search">
        <Field id="user-search" label="Search">
          <Input type="search" placeholder="Name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </Field>
        <Field id="user-role" label="Role">
          <Select
            value={role}
            options={ROLE_OPTIONS}
            onValueChange={(next) => {
              setRole(next);
              apply({ role: next });
            }}
          />
        </Field>
        <Checkbox
          label="Partners only"
          checked={partnersOnly}
          onChange={(e) => {
            setPartnersOnly(e.target.checked);
            apply({ partnersOnly: e.target.checked });
          }}
          className="pb-2.5"
        />
        <Button type="submit" leadingIcon={<Search className="size-4" />}>
          Search
        </Button>
      </form>

      {users.isError ? (
        <ErrorState title="Couldn't load users" description={users.error.message} />
      ) : users.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <div className={users.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <Table<AdminUser>
            caption="Users"
            density="compact"
            rows={users.data.data}
            getRowKey={(u) => u.id}
            columns={[
              {
                key: "user",
                header: "User",
                cell: (u) => (
                  <span className="flex items-center gap-2.5">
                    <Avatar name={u.fullName ?? u.email ?? "?"} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-semibold">{u.fullName ?? "—"}</span>
                      {u.isDemo ? <Badge tone="warning">Demo</Badge> : null}
                    </span>
                  </span>
                ),
              },
              {
                key: "contact",
                header: "Contact",
                cell: (u) => (
                  <span className="flex flex-col">
                    <span>{u.phone ?? "—"}</span>
                    <span className="text-xs text-fg-muted">{u.email ?? "No email"}</span>
                  </span>
                ),
              },
              {
                key: "roles",
                header: "Roles",
                cell: (u) => (
                  <span className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <Badge key={r.key} tone={r.key === "traveler" ? "neutral" : "info"}>
                        {r.name}
                      </Badge>
                    ))}
                  </span>
                ),
              },
              {
                key: "orgs",
                header: "Partner organisations",
                cell: (u) =>
                  u.providers.length === 0 ? (
                    <span className="text-fg-muted">—</span>
                  ) : (
                    <span className="flex flex-col gap-1">
                      {u.providers.map((p) => (
                        <span key={p.id} className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{p.displayName}</span>
                          <span className="text-xs text-fg-muted">({p.role})</span>
                          <StatusChip kind="provider" status={p.status} />
                        </span>
                      ))}
                    </span>
                  ),
              },
              {
                key: "status",
                header: "Status",
                cell: (u) => (
                  <Badge tone={USER_STATUS[u.status].tone} dot>
                    {USER_STATUS[u.status].label}
                  </Badge>
                ),
              },
              { key: "joined", header: "Joined", cell: (u) => fmtDate(u.createdAt), hideOnMobile: true },
              { key: "last", header: "Last sign-in", cell: (u) => fmtDate(u.lastLoginAt), align: "right", hideOnMobile: true },
            ]}
            empty={<EmptyState title="No users match" description="Try a different name, email, phone number or role." />}
          />
        </div>
      )}

      <Pagination page={query.page ?? 1} pageCount={pageCount} hrefFor={(p) => hrefFor(applied.current, p)} />
    </div>
  );
}
