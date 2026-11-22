import { DualScrollbar } from "@/components/DualScrollbar";
import type { TeachingGridRow } from "@/lib/data/teaching-assignments";

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * The plain, read-only counterpart to `TeachingGridForm` -- no inputs,
 * no save button, just text (2026-11-08, the new "Lessons" pages: "it
 * shows the same info but with edit ability" was Planning's own
 * description; Lessons gets the opposite -- "it should show date,
 * topic, teacher but no edit ability"). A Server Component, not a
 * Client Component, since there's no interactivity here at all.
 *
 * **Teacher column dropped, 2026-11-14** -- the user's own request at
 * the time, right after confirming the Topic pre-fill sweep
 * (migration 105) landed correctly: "Let's not show the teacher in
 * the public view of the teaching planning lists." `row.teacher`
 * itself was untouched in the data layer the whole time, simply not
 * rendered here.
 *
 * **Teacher brought back for youth specifically, 2026-11-22** -- a
 * reversal of just that one piece, per the user's own follow-up: "I
 * would like to also have teachers for youth visible to the public
 * when they are logged in, not just in the planning view." New
 * `showTeacher` prop (default `false`, so `/adult-teaching-lessons`
 * -- Elders Quorum/Relief Society, never named in this request --
 * keeps rendering exactly as it did before) is passed `true` only
 * from `/ym-yw-lessons`. Column order when shown is Sunday, Topic,
 * Teacher -- matching this component's own original pre-2026-11-14
 * order (deliberately Topic-before-Teacher, unlike `TeachingGridForm`'s
 * editable grid, which puts Teacher first), not the editable grid's
 * order, so reintroducing it doesn't quietly change a decision that
 * was never part of this request.
 *
 * **Second-hour class cancellations shown, 2026-11-14** -- same
 * "Cancelled" badge + reason styling `ActivitiesTable.tsx` already
 * uses for a cancelled youth activity, "shown, not hidden" rather than
 * blanking the row entirely.
 */
export function TeachingGridReadOnly({ rows, showTeacher = false }: { rows: TeachingGridRow[]; showTeacher?: boolean }) {
  return (
    <div className="mt-4">
      <DualScrollbar>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                Sunday
              </th>
              <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                Topic
              </th>
              {showTeacher && (
                <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                  Teacher
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.classDate} className="border-t border-rule-strong/40 even:bg-accent-soft hover:bg-accent/15">
                <td className="whitespace-nowrap px-2 py-2 align-top text-xs text-ink">{formatDate(row.classDate)}</td>
                <td className="px-2 py-2 align-top text-xs text-ink">
                  {row.cancelled ? (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-danger">Cancelled</span>
                  ) : (
                    row.topic || "—"
                  )}
                  {row.cancelled && row.cancellationNote && (
                    <div className="mt-1 text-xs text-danger">Cancelled: {row.cancellationNote}</div>
                  )}
                </td>
                {showTeacher && (
                  <td className="px-2 py-2 align-top text-xs text-ink">{row.cancelled ? "—" : row.teacher || "—"}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </DualScrollbar>
    </div>
  );
}
