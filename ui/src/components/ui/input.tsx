import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Rebased onto Liquid Gold's input (t229 Gold-method transplant, 2026-10-11):
// the 44px `h-11` touch track, the filled `bg-surface` field, and the `search`
// variant's leading-icon `ps-9` room. Gold's arbitrary 3px focus ring becomes
// the existing `--rad-3` token (token-only law); `rounded-lg` resolves to 0
// through the radius knob. Clayon's dark translucent fill drops — the field
// is a filled surface in every theme.
type InputProps = React.ComponentProps<"input"> &
  VariantProps<typeof inputVariants>

const inputVariants = cva(
  [
    "h-11 w-full min-w-0 rounded-lg border border-input bg-surface px-3 py-1 text-base transition-[color,box-shadow,background-color] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-(length:--rad-3)",
    "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  ],
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "",
        search: "ps-9",
      },
    },
  }
)

function Input({ className, type, variant, ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Input, inputVariants }
