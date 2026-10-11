import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import "@/components/portal/Portal.css";

interface PortalProps {
  children: ReactNode;
  detail?: ReactNode;
  className?: string;
}

/**
 * The entry threshold: a flat, theme-aware surface (Gold law: light and dark
 * tokens, no decorative scene — leader ruling 2026-10-11) with the amber
 * emblem as the logo. The former ring/orbit scene is removed; the emblem
 * stays only here, luminance-masked for transparency.
 */
export function Portal({ children, detail = "Built around your mission.", className }: PortalProps) {
  return (
    <div className={cn("halo-portal", className)}>
      <header className="halo-portal-header">
        <div className="halo-portal-brand">
          <span className="halo-portal-brand-mark" aria-hidden="true">CL / 01</span>
          <span className="halo-portal-wordmark">Clayon</span>
        </div>
      </header>
      <main id="portal-main" className="halo-portal-main">
        <img className="halo-portal-emblem" src="/portal/emblem.webp" alt="" aria-hidden="true" />
        {children}
      </main>
      <footer className="halo-portal-footer">
        <span>Human direction. Agent ambition.</span>
        <span>{detail}</span>
      </footer>
    </div>
  );
}
