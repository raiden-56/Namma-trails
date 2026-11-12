"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

type Placement = "center" | "right" | "bottom" | "left";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  placement?: Placement;
  className?: string;
}

const placementClasses: Record<Placement, string> = {
  center: "m-auto w-[min(36rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] rounded-xl",
  right: "ml-auto mr-0 my-0 h-dvh max-h-dvh w-[min(28rem,100vw)] rounded-l-xl",
  left: "mr-auto ml-0 my-0 h-dvh max-h-dvh w-[min(22rem,88vw)] rounded-r-xl",
  bottom: "mt-auto mb-0 mx-0 w-screen max-w-none max-h-[88dvh] rounded-t-2xl",
};

/**
 * Modal / drawer / bottom sheet built on the native <dialog> element:
 * showModal() renders in the top layer (portal-equivalent) and makes the rest of
 * the page inert, so focus is trapped; Esc closes; body scroll is locked while open.
 * Focus returns to the previously focused element on close.
 */
export function Dialog({ open, onClose, title, description, children, footer, placement = "center", className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const previouslyFocused = document.activeElement as HTMLElement | null;
      dialog.showModal();
      const root = document.documentElement;
      const prevOverflow = root.style.overflow;
      root.style.overflow = "hidden";
      return () => {
        root.style.overflow = prevOverflow;
        if (dialog.open) dialog.close();
        previouslyFocused?.focus?.();
      };
    }
    if (!open && dialog.open) dialog.close();
    return undefined;
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Click on the backdrop (the dialog element itself, outside the panel) closes.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "bg-surface-raised p-0 text-fg shadow-lift backdrop:bg-ink/55 backdrop:backdrop-blur-[2px]",
        "open:animate-fade-up",
        placementClasses[placement],
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[inherit] min-h-0 flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-1">
              <h2 id={titleId} className="font-display text-2xl leading-tight">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="text-sm text-fg-muted">
                  {description}
                </p>
              ) : null}
            </div>
            <IconButton label="Close" icon={<X className="size-5" />} onClick={onClose} className="-mr-2 -mt-1" />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
          {footer ? <footer className="flex flex-wrap justify-end gap-3 border-t border-line px-5 py-4 sm:px-6">{footer}</footer> : null}
        </div>
      ) : null}
    </dialog>
  );
}

export function Modal(props: Omit<DialogProps, "placement">) {
  return <Dialog {...props} placement="center" />;
}

/** Side drawer on desktop; pass placement="bottom" for a mobile bottom sheet. */
export function Sheet(props: DialogProps) {
  return <Dialog placement="right" {...props} />;
}
