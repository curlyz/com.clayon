import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/*
 * The one dropdown trigger (design-system.md rule 9, locked spec 2026-10-03;
 * transplanted from Liquid Gold's InlineSelect for t229): a choosable value
 * as inline sentence text in the accent with a dotted underline — no box, no
 * chevron; hover and focus brighten the accent and make the underline solid.
 * The native <select> stays stretched transparently over the word
 * (appearance-none, invisible text) so the browser owns a11y and the phone's
 * picker; the leaf's py-3 padding grows the hit area past 44px. The
 * surrounding sentence words are the caller's muted spans. Gold's
 * text-provenance resolves through Clayon's amber accent token; the 5px
 * underline offset is the token layer's --inline-select-underline-offset.
 */
const inlineSelectVariants = cva(
  "group relative inline-grid cursor-pointer py-3 leading-5",
  {
    defaultVariants: { width: "fit" },
    variants: { width: { fill: "w-full", fit: "w-fit" } },
  }
)

const inlineSelectValueVariants = cva(
  "self-center text-sm font-medium text-provenance underline decoration-provenance/50 decoration-dotted underline-offset-(--inline-select-underline-offset) group-hover:text-provenance-foreground group-hover:decoration-solid group-has-[:focus-visible]:text-provenance-foreground group-has-[:focus-visible]:decoration-solid"
)

interface InlineSelectProps extends VariantProps<typeof inlineSelectVariants> {
  ariaLabel: string
  disabled?: boolean
  id?: string
  onChange: (value: string) => void
  options: ReadonlyArray<{ label: string; value: string }>
  value: string
}

export const InlineSelect = ({
  ariaLabel,
  disabled = false,
  id,
  onChange,
  options,
  value,
  width,
}: InlineSelectProps) => (
  <span className={cn(inlineSelectVariants({ width }))}>
    <span
      aria-hidden
      className={cn(inlineSelectValueVariants(), disabled && "opacity-55")}
    >
      {options.find((option) => option.value === value)?.label ?? value}
    </span>
    <select
      aria-label={ariaLabel}
      className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent text-transparent"
      disabled={disabled}
      id={id}
      onChange={(event) => onChange(event.currentTarget.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </span>
)
