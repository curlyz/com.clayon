import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Autosave (operator directive: "everything must be autosave" — no
 * Discard/Save button pairs anywhere). One hook instance per field (or per
 * form draft): a change schedules a debounced save through the surface's
 * existing mutation; in-flight saves coalesce (last write wins); a failure
 * keeps the draft and surfaces inline state with a Retry action.
 *
 * The consumer owns the draft state; this hook only observes it:
 *
 *   const [name, setName] = useState(company.name);
 *   const autosave = useAutosave({
 *     value: name,
 *     savedValue: company.name,
 *     save: (next) => companiesApi.update(company.id, { name: next }),
 *   });
 *
 * Toggles/selects/radios pass `debounceMs: 0` so they save immediately.
 */
export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

/** How long "Saved" stays visible before the status text disappears. */
const SAVED_LINGER_MS = 2000;

export type UseAutosaveParams<T> = {
  /** Current draft value (what the user is editing). */
  value: T;
  /** Last committed value from the server; equal to `value` means clean. */
  savedValue: T;
  /** Persists `value` through the surface's existing mutation. */
  save: (value: T) => Promise<unknown>;
  /** Debounce window for text input. Default 800 ms; 0 for instant controls. */
  debounceMs?: number;
  /** Value equality. Default Object.is; pass a deep compare for object drafts. */
  isEqual?: (a: T, b: T) => boolean;
  /**
   * Save gate, separate from equality: while false no save is scheduled or
   * retried (an invalid draft sits in the field unsaved, like the old
   * disabled Save button). Keep validity here, not inside `isEqual`.
   */
  isSaveable?: (value: T, savedValue: T) => boolean;
};

export type AutosaveController = {
  status: AutosaveStatus;
  /** True while the draft differs from the committed baseline. */
  isDirty: boolean;
  /** Message for the failed save, shown inline next to the field. */
  errorMessage: string | null;
  /** Cancel the debounce and save now (blur, section close). */
  flush: () => void;
  /** Re-attempt the failed save with the current draft. */
  retry: () => void;
  /** Clear status without saving (after the baseline was externally replaced). */
  reset: () => void;
};

/**
 * Convenience `isEqual` for plain-object drafts (field order must be stable
 * on both sides). Without a value-comparing `isEqual`, a fresh object
 * literal per render reads as permanently dirty and never stops saving.
 */
export function autosaveJsonEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function readErrorMessage(error: unknown): string {
  const text = String(error).replace(/^Error:\s*/, "");
  return text ? text : "Couldn't save";
}

export function useAutosave<T>({
  value,
  savedValue,
  save,
  debounceMs = 800,
  isEqual = Object.is,
  isSaveable = () => true,
}: UseAutosaveParams<T>): AutosaveController {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDirty = isEqual(value, savedValue) === false;

  // Latest-value refs so the async save path always reads the newest draft.
  const valueRef = useRef(value);
  valueRef.current = value;
  const savedValueRef = useRef(savedValue);
  savedValueRef.current = savedValue;
  const saveRef = useRef(save);
  saveRef.current = save;
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  const isSaveableRef = useRef(isSaveable);
  isSaveableRef.current = isSaveable;
  const isSaveableNow = useCallback(
    () => isSaveableRef.current(valueRef.current, savedValueRef.current),
    [],
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedLingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);
  const followUpRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (savedLingerTimerRef.current) {
      clearTimeout(savedLingerTimerRef.current);
      savedLingerTimerRef.current = null;
    }
  }, []);

  const runSaveRef = useRef<() => void>(() => {});

  const runSave = useCallback(() => {
    if (!isSaveableNow()) return;
    if (inFlightRef.current) {
      // An older save is in flight: coalesce — the newest draft is saved
      // when it settles (last write wins per field).
      followUpRef.current = true;
      return;
    }
    clearTimers();
    setStatus("saving");
    setErrorMessage(null);
    inFlightRef.current = true;
    void (async () => {
      try {
        await saveRef.current(valueRef.current);
      } catch (error) {
        inFlightRef.current = false;
        followUpRef.current = false;
        setStatus("error");
        setErrorMessage(readErrorMessage(error));
        return;
      }
      inFlightRef.current = false;
      if (followUpRef.current) {
        followUpRef.current = false;
        runSaveRef.current();
        return;
      }
      setStatus("saved");
      savedLingerTimerRef.current = setTimeout(() => {
        savedLingerTimerRef.current = null;
        setStatus("idle");
      }, SAVED_LINGER_MS);
    })();
  }, [clearTimers, isSaveableNow]);

  runSaveRef.current = runSave;

  // A change to the draft (or the baseline refetch) schedules the next save;
  // a draft that is not saveable (invalid) stays unsaved, never scheduled.
  useEffect(() => {
    if (isDirty && isSaveableRef.current(value, savedValue)) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        runSaveRef.current();
      }, debounceMs);
    }
    // `savedValue` is a dependency on purpose: when the baseline catches up
    // and the draft is clean the effect is a no-op, and when the server
    // normalized the value it schedules one converging re-save.
  }, [value, savedValue, isDirty, debounceMs]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isDirtyRef.current && status !== "error" && status !== "saving") {
      runSaveRef.current();
    }
  }, [status]);

  const flushRef = useRef(flush);
  flushRef.current = flush;

  const retry = useCallback(() => {
    if (isDirtyRef.current) {
      runSaveRef.current();
    }
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    followUpRef.current = false;
    setStatus("idle");
    setErrorMessage(null);
  }, [clearTimers]);

  // Flush pending edits when the surface unmounts (which is what a route
  // change does to a page component). Deliberately not `useLocation`: this
  // hook must also mount in Router-less tests and embedded surfaces.
  useEffect(() => {
    return () => {
      flushRef.current();
    };
  }, []);

  // Warn when the tab closes with edits pending or in flight. The save is
  // deliberately NOT started here: an async fetch issued in beforeunload can
  // be cancelled by teardown, so the unload prompt is the honest protection.
  useEffect(() => {
    if (!isDirty && status !== "saving") return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, status]);

  useEffect(() => clearTimers, [clearTimers]);

  return { status, isDirty, errorMessage, flush, retry, reset };
}
