import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  /** Hide on the mobile stacked-card layout. */
  hideOnMobile?: boolean;
  className?: string;
}

/**
 * Data table. ≥ md: a real <table>. < md: each row becomes a labelled card,
 * so admin and partner tables stay usable on phones without horizontal scrolling.
 */
export function Table<T>({
  columns,
  rows,
  getRowKey,
  caption,
  empty,
  density = "comfortable",
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  caption: string;
  empty?: ReactNode;
  density?: "comfortable" | "compact";
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  const cellPad = density === "compact" ? "px-3 py-2" : "px-4 py-3";

  return (
    <div>
      <div className="hidden overflow-x-auto rounded-lg border border-line md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-sunken text-left">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(cellPad, "font-semibold text-fg-muted", col.align === "right" && "text-right", col.className)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getRowKey(row)} className="border-t border-line bg-surface-raised hover:bg-surface">
                {columns.map((col) => (
                  <td key={col.key} className={cn(cellPad, "align-middle", col.align === "right" && "text-right tabular-nums", col.className)}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={getRowKey(row)} className="rounded-lg border border-line bg-surface-raised p-4">
            <dl className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-2 text-sm">
              {columns
                .filter((c) => !c.hideOnMobile)
                .map((col) => (
                  <div key={col.key} className="contents">
                    <dt className="text-fg-muted">{col.header}</dt>
                    <dd className="min-w-0 break-words">{col.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
