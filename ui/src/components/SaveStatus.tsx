import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { AutosaveStatus } from "@/hooks/useAutosave";

/**
 * Quiet autosave status for a field or section header (operator directive:
 * everything autosaves — never a toast, never a button bar). "Saving…" is
 * muted text, "Saved" success text that fades out (motion-safe only), and a
 * failure is destructive text with an inline Retry that keeps the draft.
 */
export function SaveStatus({
  status,
  errorMessage,
  onRetry,
  className,
}: {
  status: AutosaveStatus;
  errorMessage?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  // After the hook goes idle, "Saved" fades out instead of blinking off.
  const [savedFading, setSavedFading] = useState(false);
  const wasSavedRef = useRef(false);

  useEffect(() => {
    if (status === "saved") {
      wasSavedRef.current = true;
      setSavedFading(false);
      return;
    }
    if (wasSavedRef.current && status === "idle") {
      wasSavedRef.current = false;
      setSavedFading(true);
      const timer = setTimeout(() => setSavedFading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [status]);

  if (status === "error") {
    return (
      <span role="alert" className={cn("flex items-center gap-2 text-xs", className)}>
        <span className="text-destructive">{errorMessage ?? "Couldn't save"}</span>
        {onRetry ? (
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-2 hover:text-muted-foreground"
            onClick={onRetry}
          >
            Retry
          </button>
        ) : null}
      </span>
    );
  }

  if (status === "idle" && !savedFading) return null;

  const saved = status === "saved" || savedFading;

  return (
    <span
      role="status"
      className={cn(
        "text-xs motion-safe:transition-opacity motion-safe:duration-300",
        saved ? "text-status-done opacity-100" : "text-muted-foreground",
        savedFading && "opacity-0",
        className,
      )}
    >
      {saved ? "Saved" : "Saving…"}
    </span>
  );
}
