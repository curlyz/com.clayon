/**
 * Shared unknown-JSON helpers for the adapter CLI event formatters.
 *
 * Each agent emits its own stdout event JSON, so the formatters read
 * parsed records field by field instead of through a fixed schema.
 * These helpers used to be copy-pasted into every adapter's
 * `src/cli/format-event.ts`; they now live here once and are imported
 * via `@clayon/adapter-utils/unknown-json`.
 */

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function stringifyUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Best-effort human message from an unknown error-shaped record.
 * Union of the per-adapter fallback chains this helper replaces:
 * message → error → code → data.message → name → JSON dump.
 */
export function errorText(value: unknown): string {
  if (typeof value === "string") return value;
  const rec = asRecord(value);
  if (!rec) return "";
  const data = asRecord(rec.data);
  const msg =
    asString(rec.message) ||
    asString(rec.error) ||
    asString(rec.code) ||
    asString(data?.message) ||
    asString(rec.name) ||
    "";
  if (msg) return msg;
  try {
    return JSON.stringify(rec);
  } catch {
    return "";
  }
}
