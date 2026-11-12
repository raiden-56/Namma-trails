"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type Ref } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { controlClasses } from "./Input";
import { PopoverPanel, insetButtonClasses, insetLabelClasses, insetWrapClasses, useAnchoredPanel } from "./Popover";

export interface SelectOption {
  value: string;
  label: string;
  /** Short extra text on the right of the row, for example a price. */
  detail?: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  /** Controlled value. Leave out (and use `defaultValue`) to let the dropdown keep its own value. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Shown when no option matches the value. */
  placeholder?: string;
  /** Draws this small label inside the control (search bar look) instead of the form-field look. */
  insetLabel?: string;
  /** Adds a hidden input with this name, so the value is sent with a plain form post. */
  name?: string;
  disabled?: boolean;
  onBlur?: () => void;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

/**
 * Dropdown in the site's own style (a button that opens a list), used in place of the
 * browser's <select>. Keyboard: Up/Down, Home/End, Enter or Space to choose, Esc to
 * close, and typing a letter jumps to the option that starts with it.
 */
export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Choose…",
  insetLabel,
  name,
  disabled,
  onBlur,
  className,
  ref,
  id,
  "aria-label": ariaLabel,
  ...aria
}: SelectProps) {
  const [inner, setInner] = useState(defaultValue ?? "");
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const typed = useRef({ text: "", at: 0 });
  const listId = useId();
  const labelId = useId();
  const { anchorRef, panelRef } = useAnchoredPanel<HTMLDivElement>({ open, onClose: () => setOpen(false), maxHeight: 336 });

  const selectedIndex = options.findIndex((o) => o.value === current);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const optionId = (index: number) => `${listId}-${index}`;

  // Keep the highlighted row in view while moving through a long list with the keyboard.
  useEffect(() => {
    if (!open || active < 0) return;
    const panel = panelRef.current;
    const row = document.getElementById(`${listId}-${active}`);
    if (!panel || !row) return;
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < panel.scrollTop) panel.scrollTop = top - 6;
    else if (bottom > panel.scrollTop + panel.clientHeight) panel.scrollTop = bottom - panel.clientHeight + 6;
  }, [open, active, listId, panelRef]);

  function setButton(node: HTMLButtonElement | null) {
    buttonRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }

  function step(from: number, direction: 1 | -1): number {
    for (let i = from + direction; i >= 0 && i < options.length; i += direction) {
      if (!options[i]?.disabled) return i;
    }
    return from;
  }

  function show() {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : step(-1, 1));
    setOpen(true);
  }

  function commit(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    if (value === undefined) setInner(option.value);
    if (option.value !== current) onValueChange?.(option.value);
  }

  function choose(index: number) {
    commit(index);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function typeahead(char: string) {
    const now = Date.now();
    const text = (now - typed.current.at > 600 ? "" : typed.current.text) + char.toLowerCase();
    typed.current = { text, at: now };
    const start = open ? active : selectedIndex;
    // One letter moves on to the next match; more letters refine the match from where we are.
    const from = text.length === 1 ? start + 1 : Math.max(start, 0);
    for (let n = 0; n < options.length; n++) {
      const index = (from + n + options.length) % options.length;
      const option = options[index];
      if (option && !option.disabled && option.label.toLowerCase().startsWith(text)) {
        if (open) setActive(index);
        else commit(index);
        return;
      }
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!open) show();
        else setActive((i) => step(i, event.key === "ArrowDown" ? 1 : -1));
        break;
      case "Home":
      case "End":
        if (!open) break;
        event.preventDefault();
        setActive(event.key === "Home" ? step(-1, 1) : step(options.length, -1));
        break;
      case "Enter":
      case " ":
        if (!open) break; // The button's own click opens the list.
        event.preventDefault();
        choose(active);
        break;
      case "Escape":
        if (!open) break;
        // Close the list only: without this an open <dialog> around it would close too.
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        break;
      case "Tab":
        if (open) {
          commit(active);
          setOpen(false);
        }
        break;
      default:
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) typeahead(event.key);
    }
  }

  const button = (
    <button
      ref={setButton}
      type="button"
      id={id}
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
      aria-label={ariaLabel}
      aria-labelledby={insetLabel ? labelId : undefined}
      disabled={disabled}
      onClick={() => (open ? setOpen(false) : show())}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      className={
        insetLabel
          ? insetButtonClasses
          : cn(controlClasses, "flex h-11 items-center gap-2 text-left", open && "border-accent-text ring-3 ring-accent-text/25", className)
      }
      {...aria}
    >
      <span className={cn("min-w-0 truncate", !insetLabel && "flex-1", !selected && "font-normal text-fg-subtle")}>{selected ? selected.label : placeholder}</span>
      {selected?.detail && !insetLabel ? <span className="shrink-0 text-sm tabular-nums text-fg-muted">{selected.detail}</span> : null}
      <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-fg-muted transition-transform duration-150", open && "rotate-180")} />
    </button>
  );

  const list = open ? (
    <PopoverPanel ref={panelRef} className="p-1.5">
      <ul id={listId} role="listbox" aria-label={insetLabel ?? ariaLabel ?? "Options"} className="flex flex-col gap-0.5">
        {options.map((option, index) => {
          const isSelected = index === selectedIndex;
          return (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={isSelected}
              aria-disabled={option.disabled || undefined}
              data-value={option.value}
              onPointerMove={() => {
                if (!option.disabled) setActive(index);
              }}
              onClick={() => choose(index)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-[0.9375rem] leading-snug",
                index === active && "bg-surface-sunken",
                option.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span className={cn("min-w-0 flex-1", isSelected && "font-semibold")}>{option.label}</span>
              {option.detail ? <span className="shrink-0 text-sm tabular-nums text-fg-muted">{option.detail}</span> : null}
              <Check aria-hidden="true" className={cn("size-4 shrink-0 text-accent-text", !isSelected && "invisible")} />
            </li>
          );
        })}
      </ul>
    </PopoverPanel>
  ) : null;

  const hidden = name ? <input type="hidden" name={name} value={current} /> : null;

  if (insetLabel) {
    return (
      <div ref={anchorRef} className={cn(insetWrapClasses, open && "bg-fg/5", className)}>
        <span id={labelId} className={insetLabelClasses}>
          {insetLabel}
        </span>
        {button}
        {hidden}
        {list}
      </div>
    );
  }

  return (
    <div ref={anchorRef} className="relative">
      {button}
      {hidden}
      {list}
    </div>
  );
}
