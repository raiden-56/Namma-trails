import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "strong" | "secondary" | "ghost" | "link" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "group/button relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold " +
  "transition-[background-color,color,border-color,box-shadow,transform] duration-200 ease-(--ease-swift) " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  // ink label on tomato = 5.0:1; hover swaps to burnt + ivory = 5.1:1
  primary: "bg-accent text-accent-fg hover:bg-burnt hover:text-ivory",
  strong: "bg-fg text-surface hover:bg-burnt hover:text-ivory",
  secondary: "border border-line-strong bg-transparent text-fg hover:border-fg hover:bg-fg/5",
  ghost: "bg-transparent text-fg hover:bg-fg/8",
  link: "h-auto rounded-none bg-transparent px-0 text-accent-text underline decoration-1 underline-offset-4 hover:decoration-2",
  danger: "bg-burnt text-ivory hover:bg-[#9c3d25]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-14 px-7 text-base",
};

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

type AsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined; loading?: boolean };
type AsLink = CommonProps & { href: string; prefetch?: boolean; target?: string; rel?: string; "aria-label"?: string };

export type ButtonProps = AsButton | AsLink;

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], variant === "link" ? "h-auto px-0" : sizes[size], className);
}

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", leadingIcon, trailingIcon, className, children } = props;
  const classes = buttonClasses(variant, size, className);
  const content = (
    <>
      {leadingIcon ? <span aria-hidden="true" className="inline-flex shrink-0">{leadingIcon}</span> : null}
      {children}
      {trailingIcon ? (
        <span
          aria-hidden="true"
          className="inline-flex shrink-0 transition-transform duration-200 group-hover/button:translate-x-0.5"
        >
          {trailingIcon}
        </span>
      ) : null}
    </>
  );

  if (props.href !== undefined) {
    const { href, prefetch, target, rel } = props;
    return (
      <Link href={href} prefetch={prefetch} target={target} rel={rel} aria-label={props["aria-label"]} className={classes}>
        {content}
      </Link>
    );
  }

  const {
    variant: _v,
    size: _s,
    leadingIcon: _l,
    trailingIcon: _t,
    className: _c,
    children: _ch,
    loading,
    disabled,
    type = "button",
    ...rest
  } = props;
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner label="Working" /> : null}
      {content}
    </button>
  );
}
