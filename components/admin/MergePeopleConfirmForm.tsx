"use client";

import { useActionState } from "react";
import { mergePeople } from "@/app/admin/merge-people/actions";
import type { PersonMergeDetail } from "@/lib/data/merge-people";

const initialState: { error?: string; success?: boolean } = {};

function fieldRow(label: string, value: string) {
  return (
    <div className="flex justify-between gap-3 border-t border-rule/60 py-1.5 text-xs">
      <span className="text-ink-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

/**
 * The actual confirm step -- a side-by-side of both people's own
 * fields (never auto-merged by merge_people itself, see that
 * function's own comment, so this is the one chance to notice
 * something on the removed row worth copying into the survivor by
 * hand first) plus exactly what will move, table by table, before the
 * irreversible part happens. A plain window.confirm gate on top of the
 * button itself, matching this app's own established convention for
 * every other irreversible action (Delete Meeting, Archive Person's
 * own "Delete Permanently").
 */
export function MergePeopleConfirmForm({ keep, remove }: { keep: PersonMergeDetail; remove: PersonMergeDetail }) {
  const [state, formAction, pending] = useActionState(mergePeople, initialState);
  const totalMoving = remove.references.reduce((sum, r) => sum + r.count, 0);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Merge "${remove.name}" into "${keep.name}"?\n\n${totalMoving} row(s) across ${remove.references.length} table(s) will be re-pointed to "${keep.name}", then "${remove.name}" will be permanently deleted. This cannot be undone.`
          )
        ) {
          e.preventDefault();
        }
      }}
      className="mt-6 flex flex-col gap-4"
    >
      <input type="hidden" name="keep_id" value={keep.id} />
      <input type="hidden" name="remove_id" value={remove.id} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          { label: "Keep", person: keep },
          { label: "Remove", person: remove },
        ].map(({ label, person }) => (
          <div key={person.id} className="rounded border border-rule bg-surface p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/70">{label}</p>
            <p className="mt-1 font-display text-lg">{person.name}</p>
            {fieldRow("Gender", person.gender ?? "—")}
            {fieldRow("Age group", person.ageGroup ?? "—")}
            {fieldRow("Attendance", person.attendanceStatus ?? "—")}
            {fieldRow("Active", person.active ? "Yes" : "No")}
            {fieldRow("Archived", person.archived ? "Yes" : "No")}
            {fieldRow("Has a login", person.hasLogin ? "Yes" : "No")}
          </div>
        ))}
      </div>

      <div className="rounded border border-rule bg-surface p-4">
        <p className="text-xs text-ink-muted">
          What will move from &ldquo;{remove.name}&rdquo; to &ldquo;{keep.name}&rdquo;:
        </p>
        {remove.references.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nothing -- &ldquo;{remove.name}&rdquo; has no references anywhere in the app.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {remove.references.map((r) => (
              <li key={`${r.table}.${r.column}`} className="flex justify-between text-ink">
                <span>
                  {r.table}.{r.column}
                </span>
                <span className="text-ink-muted">
                  {r.count} row{r.count === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-danger">
        The fields shown above for &ldquo;{keep.name}&rdquo; are kept exactly as they are -- nothing from &ldquo;{remove.name}
        &rdquo; is copied over automatically. Edit &ldquo;{keep.name}&rdquo; in People first if there&rsquo;s anything on the
        removed row worth keeping.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="whitespace-nowrap rounded border border-danger/40 px-4 py-2 text-sm text-danger transition-colors hover:bg-danger/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Merging..." : `Merge — delete "${remove.name}"`}
        </button>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {!pending && state.success && !state.error && <p className="text-sm text-success">Merged.</p>}
      </div>
    </form>
  );
}
