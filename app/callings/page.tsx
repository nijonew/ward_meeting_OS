import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getAllCallings } from "@/lib/data/callings";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { createCalling } from "@/app/callings/actions";

export default async function CallingsListPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const { user, profile } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Callings" />
        <p className="mt-10 text-slate">Only the Bishopric can manage callings.</p>
      </main>
    );
  }

  const callings = await getAllCallings();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Callings" />

      <div className="rounded-lg border border-rule bg-card p-6 sm:p-8">
        <h1 className="font-display text-3xl leading-tight">Callings</h1>
        <p className="mt-1 text-slate">Manage callings and holders.</p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <form action={createCalling} className="mt-4 flex flex-wrap gap-2">
          <input
            type="text"
            name="name"
            placeholder="Calling name"
            required
            className="flex-1 rounded-md border border-rule bg-transparent px-3 py-2 text-sm"
          />
          <input
            type="text"
            name="title_prefix"
            placeholder="Title prefix (optional)"
            className="flex-1 rounded-md border border-rule bg-transparent px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:bg-ink/5"
          >
            Add Calling
          </button>
        </form>
      </div>

      {callings.length === 0 ? (
        <p className="text-slate">No callings yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {callings.map((calling) => (
            <li key={calling.id}>
              <Link
                href={`/callings/${calling.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-rule bg-card p-4 transition-colors hover:bg-ink/5"
              >
                <span>
                  <span className="font-medium text-ink">
                    {calling.title_prefix ? `${calling.title_prefix} ` : ""}
                    {calling.name}
                  </span>
                  {!calling.active && (
                    <span className="ml-2 text-xs uppercase tracking-wide text-slate">Inactive</span>
                  )}
                </span>
                <span className="whitespace-nowrap text-sm text-slate">
                  {calling.current_holder_name ?? "Vacant"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
