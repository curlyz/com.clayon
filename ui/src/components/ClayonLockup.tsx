import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ClayonLockupProps extends HTMLAttributes<HTMLSpanElement> {
  decorative?: boolean;
  title?: string;
}

/**
 * The Clayon wordmark — a typographic lockup: font-semibold, tracking-tight,
 * foreground token. Deliberately no glyph; the brand reads through type alone.
 * Size it with a text-size class (`text-lg`); `className` may override.
 */
export function ClayonLockup({
  decorative = false,
  title = "Clayon",
  className,
  ...rest
}: ClayonLockupProps) {
  return (
    <span
      {...rest}
      className={cn("font-semibold tracking-tight text-foreground", className)}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : title}
    >
      Clayon
    </span>
  );
}
