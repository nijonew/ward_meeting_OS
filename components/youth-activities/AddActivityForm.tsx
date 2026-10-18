import { addYouthActivity } from "@/app/youth-activities/actions";
import { YOUTH_ACTIVITY_GROUPS, YOUTH_DEVELOPMENT_CATEGORIES } from "@/lib/data/youth-activity-constants";

/**
 * "I would like to have a way to add an activity row on the combined
 * activity tables" (the user's own request, 2026-10-11). A trimmed
 * copy of the Manage page's own Add Activity form, same plain
 * server-action-as-form-action pattern (no pending/success state,
 * matching that form's own existing behavior exactly) -- Group is
 * fixed to whichever Combined type the page already is (a hidden
 * field, not a dropdown; there's nothing to choose, the page itself
 * already says which one) rather than a new, separate server action --
 * addYouthActivity already handles any group_name.
 *
 * **Also auto-overwrites each target class's own activity on the same
 * date, 2026-10-16** -- the user's own confirmed choice, after
 * reporting that adding a Combined activity here didn't visibly
 * replace what each class already had: "I added a combined YM/YW
 * activity and it didn't overwrite the existing activities of the
 * groups on that date." `addYouthActivity` itself now does this as
 * part of the same save (see that action's own comment) -- this form
 * needed no changes to pick it up.
 *
 * **Generalized from `AddCombinedActivityForm`, 2026-10-16** -- the
 * Youth Activity Planning hub was flattened down to show Upcoming
 * Activities as one of its own direct tiles, and that tile needed the
 * same Add capability the three Combined-group pages already had, but
 * with no single fixed group to assume (it shows every group at
 * once). `groupName` is now optional: when given (the three Combined
 * pages, unchanged), Group stays a hidden field; when omitted (Upcoming
 * Activities), a real `<select>` of every group -- the same 9-value
 * list (6 classes + 3 Combined pseudo-groups) the Manage page's own
 * Add Activity form already offers -- lets the submitter pick any one
 * of them.
 */
export function AddActivityForm({ groupName }: { groupName?: string }) {
  // Wraps addYouthActivity (which returns ActionResult) to discard the
  // return value -- <form action> requires void/Promise<void>, same
  // reasoning as the identical wrapper on the Manage page's own Add
  // Activity form.
  const add = async (formData: FormData) => {
    "use server";
    await addYouthActivity(formData);
  };

  return (
    <div className="rounded border border-rule bg-surface p-4">
      <h3 className="font-display text-base">Add Activity</h3>
      <form action={add} className="mt-3 flex flex-col gap-3">
        {groupName ? (
          <input type="hidden" name="group_name" value={groupName} />
        ) : (
          <label className="text-sm text-ink-muted">
            Group
            <select
              name="group_name"
              required
              defaultValue=""
              className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="" disabled>
                Choose group
              </option>
              {YOUTH_ACTIVITY_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-ink-muted">
            Date
            <input
              type="date"
              name="activity_date"
              required
              className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="text-sm text-ink-muted">
            Time
            <input
              type="time"
              name="activity_time"
              defaultValue="19:00"
              className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>
        </div>

        <label className="text-sm text-ink-muted">
          Title
          <input
            type="text"
            name="title"
            required
            className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-ink-muted">
            Location
            <input
              type="text"
              name="location"
              className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="text-sm text-ink-muted">
            Development Category
            <select
              name="development_category"
              defaultValue=""
              className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
            >
              <option value="">None</option>
              {YOUTH_DEVELOPMENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="text-sm text-ink-muted">
          Planning Group
          <select
            name="planning_group"
            defaultValue=""
            className="mt-1 block w-full rounded border border-rule bg-paper px-3 py-2 text-sm text-ink"
          >
            <option value="">None</option>
            {YOUTH_ACTIVITY_GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="w-fit rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep"
        >
          Add &amp; Publish
        </button>
      </form>
    </div>
  );
}
