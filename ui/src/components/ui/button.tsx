import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Rebased onto Liquid Gold's button (t229 Gold-method transplant, 2026-10-11):
// Gold's behaviour and size scale win — border-visible surfaces, hover-then-
// active press feedback (one step past hover, never scale/translate), and the
// min-h touch floor (default 48px, sm 44px). Clayon's density sizes (xs,
// icon-xs, icon-sm, icon-lg) and the `cta` variant stay: this app's dense
// control-plane rows are identity, not drift. The two rounded-full Gold auth
// variants are dropped (leader ruling 2026-10-11: pills are dead code under
// DESIGN.md's square law). Gold's arbitrary 550 font weight becomes
// `font-medium` (token-only law; MonoLisa ships 400/700).
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-(--tp-color-background-color-border-color-box-shadow-opacity) outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-(length:--rad-3) disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border border-border bg-primary text-primary-foreground hover:bg-primary/92 active:bg-primary/85",
        // brand: Clayon's filled-ink primary onboarding action — Gold's
        // authPrimary treatment, square (no pill under the square law).
        cta: "border border-border bg-foreground text-background hover:bg-foreground/90 active:bg-foreground/80",
        destructive:
          "border border-border bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80 focus-visible:ring-destructive/20",
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:bg-accent/70",
        link: "text-primary underline-offset-4 hover:underline",
        outline:
          "border border-border bg-card hover:bg-accent hover:text-foreground active:bg-accent",
        // brand: Gold's provenance accent pair, resolving through Clayon's
        // amber --provenance tokens (token layer, t229).
        provenance:
          "border border-border bg-provenance text-provenance-foreground hover:bg-provenance/92 active:bg-provenance/85",
        // brand: softer than `provenance` — an included-but-not-picked state;
        // reads as "already covered", not an actionable selection.
        provenanceSoft:
          "border border-provenance/35 bg-provenance-soft text-foreground hover:bg-provenance/20 active:bg-provenance/30",
        quietIcon:
          "text-muted-foreground hover:bg-card hover:text-foreground active:bg-accent",
        secondary:
          "border border-border bg-card text-secondary-foreground hover:bg-accent hover:text-foreground active:bg-accent",
      },
      size: {
        // brand: xs and the icon-* density scale stay for dense rows — the
        // 44px floor applies to standalone controls, not in-row widgets
        // (index.css pointer:coarse exemptions cover the same split).
        default: "min-h-12 px-5 py-3 has-[>svg]:px-4",
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "min-h-11 gap-2 px-3 py-2 has-[>svg]:px-2",
        lg: "min-h-12 px-6 py-3 has-[>svg]:px-4",
        icon: "size-11 p-0",
        "icon-xs": "size-6 p-0 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 p-0",
        "icon-lg": "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean
    }
>(function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}, ref) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      ref={ref}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
})

Button.displayName = "Button"

export { Button, buttonVariants }
