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
 * Column order is Topic before Teacher here specifically, per that
 * same request's literal wording ("date, topic, teacher") --
 * deliberately different from `TeachingGridForm`'s own Teacher-then-
 * Topic order, which wasn't asked to change.
 */
export function TeachingGridReadOnly({ rows }: { rows: TeachingGridRow[] }) {
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
              <th className="px-2 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">
                Teacher
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.classDate} className="border-t border-rule-strong/40 even:bg-accent-soft hover:bg-accent/15">
                <td className="whitespace-nowrap px-2 py-2 align-top text-xs text-ink">{formatDate(row.classDate)}</td>
                <td className="px-2 py-2 align-top text-xs text-ink">{row.topic || "—"}</td>
                <td className="px-2 py-2 align-top text-xs text-ink">{row.teacher || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DualScrollbar>
    </div>
  );
}
