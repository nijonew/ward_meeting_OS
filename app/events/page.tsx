import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getYouthActivities } from "@/lib/data/youth-activities";
import { getWardEvents } from "@/lib/data/ward-events";

const YOUTH_MANAGE_ROLES = ["bishopric", "yw_presidency", "yw_advisor", "yw_specialist", "ym_advisor", "ym_specialist"];
const WARD_MANAGE_ROLES = ["bishopric", "communications_specialist"];

type ViewFilter = "youth" | "ward" | "both";

interface MergedEvent {
  key: string;
  date: string;
  time: string | null;
  title: string;
  subtitle: string;
  kind: "Youth" | "Ward";
  cancelled: boolean;
  cancellationNote: string | null;
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function TabLink({ view, current, label }: { view: ViewFilter; current: ViewFilter; label: string }) {
  const active = view === current;
  return (
    <Link
      href={`/events?view=${view}`}
      className={[
        "rounded-md px-3 py-1.5 text-xs font-mono uppercase tracking-widest transition-colors",
        active ? "bg-ink text-paper" : "text-slate hover:text-ink",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default async function ScheduledEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view: rawView } = await searchParams;
  const view: ViewFilter = rawView === "youth" || rawView === "ward" ? rawView : "both";

  const { profile } = await getSessionUser();
  const canManageYouth = Boolean(profile?.role && YOUTH_MANAGE_ROLES.includes(profile.role));
  const canManageWard = Boolean(profile?.role && WARD_MANAGE_ROLES.includes(profile.role));

  const [youthActivities, wardEvents] = await Promise.all([
    view !== "ward" ? getYouthActivities() : Promise.resolve([]),
    view !== "youth" ? getWardEvents() : Promise.resolve([]),
  ]);

  const merged: MergedEvent[] = [
    ...youthActivities.map((a) => ({
      key: `youth-${a.id}`,
      date: a.activity_date,
      time: a.activity_time,
      title: a.title,
      subtitle: a.planning_group ? `${a.group_name} — planned by ${a.planning_group}` : a.group_name,
      kind: "Youth" as const,
      cancelled: a.cancelled,
      cancellationNote: a.cancellation_note,
    })),
    ...wardEvents.map((e) => ({
      key: `ward-${e.id}`,
      date: e.event_date,
      time: e.event_time,
      title: e.title,
      subtitle: e.location ?? "",
      kind: "Ward" as const,
      cancelled: false,
      cancellationNote: null,
    })),
  ].sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Scheduled Events" />

      <section className="mt-4">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">Scheduled Events</h1>
        <div className="mt-4 flex w-fit gap-1 rounded-md border border-rule p-1">
          <TabLink view="both" current={view} label="Both" />
          <TabLink view="youth" current={view} label="Youth" />
          <TabLink view="ward" current={view} label="Ward" />
        </div>
      </section>

      <div className="rounded-lg border border-rule bg-card p-6">
        {merged.length === 0 ? (
          <p className="text-sm text-slate">Nothing scheduled yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {merged.map((item) => (
              <li
                key={item.key}
                className={[
                  "rounded-md border px-3 py-2 text-sm",
                  item.cancelled ? "border-red-900/30 bg-red-950/5" : "border-rule/60",
                ].join(" ")}
              >
                <span className="text-ink">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-slate/70">
                    {formatDate(item.date)}
                    {item.time ? ` \u00b7 ${item.time}` : ""} \u00b7 {item.kind}
                  </span>{" "}
                  {item.title}
                  {item.cancelled && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-widest text-red-700">
                      Cancelled
                    </span>
                  )}
                </span>
                {item.cancelled ? (
                  <p className="mt-1 text-red-700">
                    This activity has been cancelled{item.cancellationNote ? `: ${item.cancellationNote}` : "."}
                  </p>
                ) : (
                  item.subtitle && <p className="mt-1 text-slate">{item.subtitle}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {(canManageYouth || canManageWard) && (
        <div className="flex flex-wrap gap-4 text-sm">
          {canManageYouth && (
            <Link href="/youth-activities" className="underline">
              Manage Youth Activities
            </Link>
          )}
          {canManageWard && (
            <Link href="/ward-events" className="underline">
              Manage Ward Events
            </Link>
          )}
        </div>
      )}
    </main>
  );
}