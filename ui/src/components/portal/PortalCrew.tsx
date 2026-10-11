import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CrewProps {
  name: "Doc" | "Orb";
}

/** Supplied cast art sampled onto the bible's 64px grid, displayed at 1x or 2x. */
function CrewMember({ name }: CrewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [talking, setTalking] = useState(false);
  const [cheering, setCheering] = useState(false);
  const drag = useRef({ x: 0, y: 0, active: false, moved: false });
  const isDoc = name === "Doc";
  const speechId = `portal-${name.toLowerCase()}-speech`;

  useEffect(() => {
    const art = new Image();
    art.onload = () => {
      const context = canvas.current?.getContext("2d");
      if (!context) return;
      context.imageSmoothingEnabled = false;
      // The supplied atlas is a still roster, not the drifting Doc pilot strip.
      // Crop the two silhouettes into the same 64x64 logical frame cell.
      if (isDoc) context.drawImage(art, 24, 298, 162, 394, 19, 2, 26, 62);
      else context.drawImage(art, 624, 316, 200, 286, 10, 1, 44, 63);
    };
    art.src = "/portal/crew.webp";
    return () => { art.onload = null; };
  }, [isDoc]);

  return (
    <div className={cn("halo-portal-crew-member", isDoc ? "halo-portal-doc" : "halo-portal-orb")}>
      <button
        type="button"
        className="halo-portal-crew-button"
        aria-label={`Talk to ${name}`}
        aria-expanded={talking}
        aria-controls={speechId}
        data-cheering={cheering}
        onClick={() => {
          if (drag.current.moved) { drag.current.moved = false; return; }
          setTalking(!talking);
        }}
        onDoubleClick={() => { setTalking(true); setCheering(true); }}
        onAnimationEnd={() => setCheering(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setTalking(false); setCheering(false); }
        }}
        onPointerDown={(event) => {
          if (event.button !== 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          drag.current = { x: event.clientX, y: event.clientY, active: true, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current.active) return;
          const offset = Math.round(event.clientX - drag.current.x);
          const limit = event.currentTarget.offsetWidth;
          drag.current.moved ||= Math.abs(offset) > 4;
          // Drag stays on the crew's own ledge; controls never become drop targets.
          event.currentTarget.style.setProperty("--halo-portal-crew-drag", `${Math.max(-limit, Math.min(limit, offset))}px`);
        }}
        onPointerUp={(event) => {
          if (!drag.current.active) return;
          drag.current.active = false;
          event.currentTarget.style.removeProperty("--halo-portal-crew-drag");
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          drag.current.active = false;
          event.currentTarget.style.removeProperty("--halo-portal-crew-drag");
        }}
      >
        <canvas ref={canvas} width={64} height={64} className="halo-portal-sprite" aria-hidden="true" />
        <span className="halo-portal-crew-name">{name}</span>
      </button>
      <p id={speechId} className="halo-portal-speech" hidden={!talking}>
        <strong>{name}:</strong> {isDoc ? "You bring the mission. We bring the tools." : "A new world is one step away."}
      </p>
    </div>
  );
}

export function PortalCrew() {
  return (
    <aside className="halo-portal-crew" aria-label="Portal crew">
      <CrewMember name="Doc" />
      <CrewMember name="Orb" />
    </aside>
  );
}
