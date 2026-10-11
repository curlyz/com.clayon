/**
 * Pure routine-detail navigation helpers. Relocated verbatim from the retired
 * RoutineContextualSidebar (redesign brief ADDENDUM 2: contextual sub-sidebars
 * are removed; these helpers stay because routine pages and section rows keep
 * linking to `/routines/<id>/<view>` destinations).
 */
import { z } from "zod";

export const ROUTINE_DETAIL_VIEWS = [
  "overview",
  "triggers",
  "variables",
  "delivery",
  "secrets",
  "history",
  "runs",
  "activity",
] as const;

export type RoutineDetailView = (typeof ROUTINE_DETAIL_VIEWS)[number];

/** Parses a route segment into a view; `.data` is undefined when not a view. */
export const routineDetailViewSchema = z.enum(ROUTINE_DETAIL_VIEWS);

export function routineDetailHref(routineId: string, view: RoutineDetailView = "overview") {
  return `/routines/${routineId}/${view}`;
}

/** Keep routine configuration and operations in the routine detail shell. */
export function resolveRoutineDetailDestination(input: {
  routineId: string;
  section?: string | null;
  legacyTab?: string | null;
}) {
  const requested = routineDetailViewSchema.safeParse(input.legacyTab ?? input.section).data;
  return routineDetailHref(input.routineId, requested ?? "overview");
}
