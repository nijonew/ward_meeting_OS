import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { BulkMusicEntry } from "@/components/music/BulkMusicEntry";
import { QuickAddMusic } from "@/components/music/QuickAddMusic";
import { RecentMusicList } from "@/components/music/RecentMusicList";
import { getActivePeople } from "@/lib/data/people";
import { getRecentMusic } from "@/lib/data/music-list";
import { getSessionUser } from "@/lib/supabase/get-session-user";

export default async function MusicPage() {
  const { user, profile } = await getSessionUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Music" />
        <p className="mt-10 text-slate">Sign in to add music.</p>
        <Link
          href="/login"
          className="mt-4 inline-flex w-fit items-center rounded-md bg-ink px-5 py-2.5 font-body text-sm font-medium text-paper transition-colors hover:bg-ink/90"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const canEnterMusic = profile?.role === "music_planner" || profile?.role === "bishopric";

  if (!canEnterMusic) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Music" />
        <p className="mt-10 text-slate">
          Your account doesn&rsquo;t have access to music entry yet. Ask the Bishopric to assign
          you the Music planner role.
        </p>
      </main>
    );
  }

  const [people, recent] = await Promise.all([getActivePeople(), getRecentMusic()]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Music" />

      <BulkMusicEntry people={people} />
      <QuickAddMusic people={people} />
      <RecentMusicList items={recent} />

      <footer className="mt-auto pt-16 text-xs text-slate">
        Ward Meeting OS &mdash; planning, conducting, and publishing meetings from one source of
        truth.
      </footer>
    </main>
  );
}
