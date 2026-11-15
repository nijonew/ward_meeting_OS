/**
 * Pure types/helpers with no `createClient` import -- split out of
 * `calling-planning.ts` 2026-11-14, same reason as
 * `sacrament-program-shared.ts`/`rotations-shared.ts` before it:
 * `CallingPlanningGridForm.tsx` (a Client Component) needs
 * `formatCallingOptionLabel` as a real value import, and importing a
 * real value from a module that also imports `@/lib/supabase/server`
 * (which itself imports `next/headers`, a server-only API) drags that
 * whole dependency into the client bundle and breaks the build --
 * confirmed directly, this is not a hypothetical. `calling-planning.ts`
 * re-exports both of these for its own (server-only) callers, so
 * nothing there needed to change its own imports.
 */

export interface CallingOption {
  id: string;
  name: string;
  title_prefix: string | null;
  /** Added 2026-11-14 for the Calling dropdown's own richer label --
   *  see formatCallingOptionLabel below. Null means currently vacant. */
  current_holder_name: string | null;
}

/**
 * "(Calling) - (current holder, or N/A)" -- the Calling dropdown's own
 * display label, 2026-11-14 (the user's own request: "I would like to
 * have the dropdown for entering a new calling into the calling
 * planning table to include... '(calling title) - (person currently
 * in calling or N/A)' rather than just the title"). A separate
 * function from `CallingOption.name` itself -- the grid's own
 * "Calling" column (sort/filter/the committed cell text) still shows
 * and compares on the plain title alone, unaffected; this is purely
 * what the picker's own option list shows while choosing.
 */
export function formatCallingOptionLabel(c: CallingOption): string {
  return `${c.name} - ${c.current_holder_name ?? "N/A"}`;
}
