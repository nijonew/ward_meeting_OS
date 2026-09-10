import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getGeneralSubmissions } from "@/lib/data/general-submissions";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { setSubmissionStatus } from "@/app/announcements/actions";

export default async function AnnouncementsInboxPage() {
  const { user, profile } = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Announcements" />
        <p className="mt-10 text-ink-muted">Only the Bishopric can review submissions.</p>
      </main>
    );
  }

  const items = await getGeneralSubmissions();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Announcements" />

      <div className="rounded-lg border border-rule bg-surface p-6">
        <h2 className="font-display text-xl">Submissions</h2>
        <p className="mt-1 text-xs text-ink-muted">
          General submissions not tied to a specific meeting. Agenda items added directly on a
          Bishopric Meeting&rsquo;s Planning tab live there instead, not here.
        </p>

        {items.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">Nothing submitted yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {items.map((item) => {
              const publish = async () => {
                "use server";
                await setSubmissionStatus(item.kind, item.id, "published");
              };
              const archive = async () => {
                "use server";
                await setSubmissionStatus(item.kind, item.id, "archived");
              };
              return (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="rounded-md border border-rule/60 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-ink">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-ink-muted/70">
                        {item.kind === "announcement" ? "Announcement" : "Agenda Item"}
                      </span>{" "}
                      {item.title}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={[
                          "font-mono text-[10px] uppercase tracking-widest",
                          item.status === "published"
                            ? "text-success"
                            : item.status === "archived"
                              ? "text-ink-muted/50"
                              : "text-accent",
                        ].join(" ")}
                      >
                        {item.status}
                      </span>
                      {item.status !== "published" && (
                        <form action={publish}>
                          <button type="submit" className="text-xs text-ink-muted hover:text-ink">
                            Publish
                          </button>
                        </form>
                      )}
                      {item.status !== "archived" && (
                        <form action={archive}>
                          <button type="submit" className="text-xs text-ink-muted hover:text-ink">
                            Archive
                          </button>
                        </form>
                      )}
                    </span>
                  </div>
                  {item.body && <p className="mt-1 text-ink-muted">{item.body}</p>}
                  <p className="mt-1 text-[11px] text-ink-muted/60">
                    {item.submitted_by_name} &lt;{item.submitted_by_email}&gt;
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}