import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getAllCallings } from "@/lib/data/callings-list";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { createCalling } from "@/app/callings/actions";

const STATUS_LABELS: Record<string, string> = {
  discussing: "Discussing",
  future: "Future",
  declined: "Declined",
  to_announce: "To Announce",
  to_be_set_apart: "To Be Set Apart",
  to_record: "To Record",
  complete: "Complete",
};

export default async function CallingsPage({
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

      <div className="rounded-lg border border-rule bg-card p-6">
        <h2 className="font-display text-xl">All Callings</h2>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <ul className="mt-4 flex flex-col gap-1.5">
          {callings.map((c) => (
            <li key={c.id}>
              <Link
                href={`/callings/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-rule/60 px-3 py-2 text-sm transition-colors hover:border-ink/30"
              >
                <span className={c.active ? "text-ink" : "text-ink/40"}>
                  {c.title_prefix ? `${c.title_prefix} ` : ""}
                  {c.name}
                </span>
                <span className="flex items-center gap-2 text-xs text-slate">
                  {c.current_holder_name ?? "Vacant"}
                  {c.planning_status && (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-brass">
                      {STATUS_LABELS[c.planning_status] ?? c.planning_status}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <form action={createCalling} className="mt-4 flex flex-wrap gap-2 border-t border-rule/60 pt-4">
          <input
            type="text"
            name="title_prefix"
            placeholder="Title (Brother, Sister, President...)"
            className="rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
          <input
            type="text"
            name="name"
            required
            placeholder="New calling name"
            className="flex-1 rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90"
          >
            Add
          </button>
        </form>
      </div>
    </main>
  );
}
