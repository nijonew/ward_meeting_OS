import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getActivePeople } from "@/lib/data/people";
import { getCallingAssignmentOptions, getPersonCallingIds } from "@/lib/data/person-callings";
import { PersonCallingsForm } from "@/components/admin/PersonCallingsForm";

/**
 * A dropdown-and-checkboxes assignment UI for `callings.current_holder_id`,
 * the inverse of /admin/calling-features (that one: one calling, many
 * features, a real join table; this one: one person, many callings,
 * each calling a single nullable FK) -- the user's own request
 * (2026-10-30): "an assignable calling dropdown with the ability to
 * assign multiple callings by checkbox and have it cross reference
 * with the callings list." Pick a person, see every calling with
 * whoever else currently holds it (if anyone), check/uncheck, save all
 * at once -- same gate as the raw Callings grid (`table_admin_callings`),
 * since this is just a purpose-built front end for the same column.
 */
export default async function PersonCallingsPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (!hasFeature(profile, "table_admin_callings")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Assign Callings" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to assign callings.</p>
      </main>
    );
  }

  const { person: personId } = await searchParams;
  const people = await getActivePeople();
  const selectedPerson = personId ? people.find((p) => p.id === personId) : undefined;
  const [callings, heldCallingIds] = selectedPerson
    ? await Promise.all([getCallingAssignmentOptions(selectedPerson.id), getPersonCallingIds(selectedPerson.id)])
    : [null, null];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Assign Callings" />

      <section className="mt-4">
        <Link href="/admin" className="text-xs text-ink-muted hover:text-ink">
          &larr; All tables
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">Assign Callings</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Pick a person to see and edit every calling they currently hold. Checking a calling that
          already has a different holder reassigns it to this person instead -- the checklist shows
          who that is beforehand, so it&rsquo;s never a surprise.
        </p>
      </section>

      <form method="get" className="flex flex-wrap items-center gap-3 rounded border border-rule bg-surface p-4">
        <label className="text-xs text-ink-muted">
          Person
          <select
            name="person"
            defaultValue={selectedPerson?.id ?? ""}
            className="ml-2 min-w-[14rem] rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink"
          >
            <option value="" disabled>
              Choose a person&hellip;
            </option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5">
          Load
        </button>
      </form>

      {selectedPerson && callings && heldCallingIds ? (
        <PersonCallingsForm
          key={selectedPerson.id}
          personId={selectedPerson.id}
          personName={selectedPerson.name}
          callings={callings}
          heldCallingIds={heldCallingIds}
        />
      ) : personId ? (
        <p className="text-sm text-ink-muted">That person couldn&rsquo;t be found.</p>
      ) : (
        <p className="text-sm text-ink-muted">Choose a person above to see and edit their callings.</p>
      )}
    </main>
  );
}
