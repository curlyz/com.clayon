import { useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { PortalCrew } from "@/components/portal/PortalCrew";
import { cn } from "@/lib/utils";
import "@/components/portal/Portal.css";

interface PortalProps {
  children: ReactNode;
  detail?: ReactNode;
  className?: string;
}

/** The entry threshold; decoration stays outside the reading and focus order. */
export function Portal({ children, detail = "Built around your mission.", className }: PortalProps) {
  const [paused, setPaused] = useState(false);
  const [gaze, setGaze] = useState("center");

  return (
    <div
      className={cn("halo-portal", className)}
      data-paused={paused}
      data-gaze={gaze}
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const position = (event.clientX - bounds.left) / bounds.width;
        setGaze(position < 0.4 ? "left" : position > 0.6 ? "right" : "center");
      }}
      onPointerLeave={() => setGaze("center")}
    >
      <div className="halo-portal-scene" aria-hidden="true">
        <img className="halo-portal-ring" src="/portal/ring.webp" alt="" fetchPriority="high" />
        <div className="halo-portal-atmosphere" />
        <div className="halo-portal-grid" />
        <div className="halo-portal-orbit-core" />
        <svg className="halo-portal-orbit" viewBox="0 0 640 640" fill="none">
          <path d="M192 16H448L624 192V448L448 624H192L16 448V192Z" />
          <path d="M208 40H432L600 208V432L432 600H208L40 432V208Z" />
          <path d="M192 4V32M448 4V32M608 192H636M608 448H636M448 608V636M192 608V636M4 448H32M4 192H32" />
        </svg>
        <div className="halo-portal-floor" />
      </div>
      <header className="halo-portal-header">
        <div className="halo-portal-brand">
          <span className="halo-portal-brand-mark" aria-hidden="true">CL / 01</span>
          <span className="halo-portal-wordmark">Clayon</span>
        </div>
        <button
          type="button"
          className="halo-portal-motion"
          aria-pressed={paused}
          aria-label={paused ? "Resume scene motion" : "Pause scene motion"}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          <span>{paused ? "Resume scene" : "Pause scene"}</span>
        </button>
      </header>
      <p className="sr-only" id="portal-scene-description">
        A ring stretches across a star-filled sky. An amber emblem marks the portal.
        Doc, a scientist with a clipboard, and Orb, a floating scanner drone, wait beside the entrance.
        The entry controls sit inside the portal. Crew reactions are optional; use the primary action to continue.
      </p>
      <main id="portal-main" className="halo-portal-main" aria-describedby="portal-scene-description">
        <img className="halo-portal-emblem" src="/portal/emblem.webp" alt="" aria-hidden="true" />
        {children}
      </main>
      <PortalCrew />
      <footer className="halo-portal-footer">
        <span>Human direction. Agent ambition.</span>
        <span>{detail}</span>
      </footer>
    </div>
  );
}
