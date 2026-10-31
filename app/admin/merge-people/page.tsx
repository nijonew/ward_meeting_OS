import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getAllPeopleForMerge, getPersonMergeDetail } from "@/lib/data/merge-people";
import { MergePeopleConfirmForm } from "@/components/admin/MergePeopleConfirmForm";

/**
 * Merge Duplicate People -- built 2026-10-31 (the user's own request,
 * once it turned out PROJECT_CONTEXT.md's own claim of "paused
 * research" on this didn't actually exist: "Yes, design and build
 * it"). Pick two people, pick which one survives, review exactly what
 * will move (migration 096's own list_people_references), confirm.
 * This is the real fix for the foreign-key error Archived People's own
 * "Delete Permanently" surfaces as-is when a person is still genuinely
 * referenced somewhere -- see that page's own note.
 */
export default async function MergePeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ keep?: string; remove?: string }>;
}) {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (!hasFeature(profile, "merge_people")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Merge Duplicate People" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to this tool.</p>
      </main>
    );
  }

  const { keep: keepId, remove: removeId } = await searchParams;
  const people = await getAllPeopleForMerge();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Merge Duplicate People" />

      <Link href="/admin" className="text-xs text-ink-muted hover:text-ink">
        &larr; All tables
      </Link>

      <h1 className="rise-in font-display text-3xl leading-tight sm:text-4xl">Merge Duplicate People</h1>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Keep
          <select name="keep" defaultValue={keepId ?? ""} className="rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink">
            <option value="" disabled>
              Choose a person&hellip;
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.archived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Remove (will be deleted)
          <select name="remove" defaultValue={removeId ?? ""} className="rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink">
            <option value="" disabled>
              Choose a person&hellip;
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.archived ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5">
          Compare
        </button>
      </form>

      {keepId && removeId && keepId === removeId && <p className="text-sm text-danger">Choose two different people.</p>}

      {keepId && removeId && keepId !== removeId && <ComparePanel keepId={keepId} removeId={removeId} />}
    </main>
  );
}

async function ComparePanel({ keepId, removeId }: { keepId: string; removeId: string }) {
  const [keep, remove] = await Promise.all([getPersonMergeDetail(keepId), getPersonMergeDetail(removeId)]);

  if (!keep || !remove) {
    return <p className="text-sm text-danger">One of the selected people could no longer be found -- refresh and try again.</p>;
  }

  return <MergePeopleConfirmForm keep={keep} remove={remove} />;
}
