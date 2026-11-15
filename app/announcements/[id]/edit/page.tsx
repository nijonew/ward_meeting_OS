import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { getAnnouncementById } from "@/lib/data/announcements";
import { updateAnnouncement } from "@/app/announcements/actions";
import { AnnouncementForm } from "@/components/submit/AnnouncementForm";

/**
 * Form-based announcement editor, 2026-11-14 (the user's own request:
 * "I would also like a way to edit announcements by using a form like
 * the entry form, rather than just the table"). The exact same
 * `AnnouncementForm` the public submit flow uses
 * (`/submit/announcement`), just pre-filled from an existing row and
 * in `mode="edit"` (which also shows a Status select the create form
 * has no equivalent of). Reached from a new "Edit via Form" link list
 * on `/announcements` -- the Manage Announcements grid itself is
 * unchanged, still there for a quick single-field tweak.
 *
 * Gated the same way Manage Announcements is (`announcement_management`),
 * not the broader `table_admin_announcements` -- this is a second
 * entry point into the same data, not a new capability, so it keeps
 * the narrower feature that page has always used.
 */
export default async function EditAnnouncementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const { id } = await params;
  const { success, error } = await searchParams;
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (!hasFeature(profile, "announcement_management")) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Edit Announcement" />
        <p className="mt-10 text-ink-muted">Your account doesn&rsquo;t have access to edit announcements.</p>
      </main>
    );
  }

  const announcement = await getAnnouncementById(id);
  if (!announcement) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Edit Announcement" />
        <p className="mt-10 text-ink-muted">That announcement no longer exists.</p>
        <Link href="/announcements" className="mt-4 text-sm text-ink-muted hover:text-ink">
          &larr; Manage Announcements
        </Link>
      </main>
    );
  }

  const save = async (formData: FormData) => {
    "use server";
    const result = await updateAnnouncement(id, formData);
    if ("error" in result) {
      redirect(`/announcements/${id}/edit?error=${encodeURIComponent(result.error)}`);
    }
    redirect(`/announcements/${id}/edit?success=1`);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col px-6 py-12 sm:px-8">
      <AppHeader tag="Edit Announcement" />

      <Link href="/announcements" className="mt-6 text-xs text-ink-muted hover:text-ink">
        &larr; Manage Announcements
      </Link>

      <section className="mt-4">
        <h1 className="rise-in font-display text-2xl leading-tight">{announcement.title}</h1>

        {success && (
          <p className="mt-4 rounded border border-rule bg-surface p-4 text-sm text-ink">Saved.</p>
        )}
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        <AnnouncementForm onSubmit={save} initial={announcement} mode="edit" />
      </section>
    </main>
  );
}
