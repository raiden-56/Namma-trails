"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";

/**
 * Confirmation dialog that can require a written reason (decline, cancel,
 * reject…). Used by the partner portal and admin screens.
 */
export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  variant = "primary",
  reasonLabel = "Reason",
  reasonHint,
  minLength = 0,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  variant?: "primary" | "secondary" | "danger";
  reasonLabel?: string;
  reasonHint?: string;
  /** 0 = no reason field. */
  minLength?: number;
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  const needsReason = minLength > 0;
  const tooShort = needsReason && reason.trim().length < minLength;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Back
          </Button>
          <Button variant={variant} loading={busy} disabled={tooShort} onClick={() => onConfirm(reason.trim())}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {needsReason ? (
          <Field id="reason-dialog-text" label={reasonLabel} hint={reasonHint ?? `At least ${minLength} characters.`}>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
