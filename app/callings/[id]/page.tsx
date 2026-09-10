import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getCallingDetail } from "@/lib/data/calling-planning";
import { getSessionUser } from "@/lib/supabase/get-session-user";

export default async function CallingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: callingId } = await params;
  const { error } = await searchParams;

  const { user, profile } = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Callings" />
        <p className="mt-10 text-ink-muted">Only the Bishopric can manage callings.</p>
      </main>
    );
  }

  const calling = await getCallingDetail(callingId);
  if (!calling) {
    return <p className="text-ink-muted">Could not find that calling.</p>;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Callings" />

      <Link href="/callings" className="text-xs text-ink-muted hover:text-ink">
        &larr; Callings
      </Link>

      <div className="rounded-lg border border-rule bg-surface p-6 sm:p-8">
        <h1 className="font-display text-3xl leading-tight">{calling.name}</h1>
        <p className="mt-1 text-ink-muted">
          Current holder: {calling.current_holder_name ?? "Vacant"}
        </p>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <Link
          href={`/calling-planning?calling=${calling.id}`}
          className="mt-4 inline-flex w-fit items-center rounded-md border border-rule px-4 py-2 text-sm text-ink transition-colors hover:bg-ink/5"
        >
          View calling changes for this calling &rarr;
        </Link>
      </div>
    </main>
  );
}
