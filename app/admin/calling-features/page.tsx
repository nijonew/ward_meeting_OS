import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getCallingOptions } from "@/lib/data/calling-planning";
import { getFeatureCatalogByCategory, getCallingFeatureKeys } from "@/lib/data/calling-features";
import { CallingFeaturesForm } from "@/components/admin/CallingFeaturesForm";

/**
 * A dropdown-and-checkboxes assignment UI for `calling_features`,
 * replacing the raw Table Admin grid's "add one row per (calling,
 * feature) pair" workflow -- the user's own concern (2026-10-04):
 * with ~58 features across every calling, that could mean thousands
 * of rows to add by hand. Pick a calling, see every feature grouped
 * by category with its current grant pre-checked, edit, and save all
 * at once -- same gate as the raw grid (`table_admin_callings`), since
 * this is just a purpose-built front end for the same table.
 */
export default async function CallingFeaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ calling?: string }>;
}) {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (!hasFeature(profile, "table_admin_callings")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Calling Features" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to assign calling features.</p>
      </main>
    );
  }

  const { calling: callingId } = await searchParams;
  const [callingOptions, categories] = await Promise.all([getCallingOptions(), getFeatureCatalogByCategory()]);
  const selectedCalling = callingId ? callingOptions.find((c) => c.id === callingId) : undefined;
  const grantedKeys = selectedCalling ? await getCallingFeatureKeys(selectedCalling.id) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Calling Features" />

      <section className="mt-4">
        <Link href="/admin" className="text-xs text-ink-muted hover:text-ink">
          &larr; All tables
        </Link>
        <h1 className="rise-in mt-2 font-display text-3xl leading-tight sm:text-4xl">Calling Features</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Pick a calling to see and edit every feature it grants to whoever currently holds it.
        </p>
      </section>

      <form method="get" className="flex flex-wrap items-center gap-3 rounded border border-rule bg-surface p-4">
        <label className="text-xs text-ink-muted">
          Calling
          <select
            name="calling"
            defaultValue={selectedCalling?.id ?? ""}
            className="ml-2 min-w-[14rem] rounded border border-rule bg-paper px-2 py-1.5 text-sm text-ink"
          >
            <option value="" disabled>
              Choose a calling&hellip;
            </option>
            {callingOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5">
          Load
        </button>
      </form>

      {selectedCalling && grantedKeys ? (
        <CallingFeaturesForm
          key={selectedCalling.id}
          callingId={selectedCalling.id}
          callingName={selectedCalling.name}
          categories={categories}
          grantedKeys={grantedKeys}
        />
      ) : callingId ? (
        <p className="text-sm text-ink-muted">That calling couldn&rsquo;t be found.</p>
      ) : (
        <p className="text-sm text-ink-muted">Choose a calling above to see and edit its features.</p>
      )}
    </main>
  );
}
