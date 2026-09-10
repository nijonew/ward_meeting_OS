import { redirect } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getAllRotations, getAssignmentGrid, type RotationRow } from "@/lib/data/rotations";
import { getActivePeople, type PersonOption } from "@/lib/data/people";
import { PushRotationForm } from "@/components/rotations/PushRotationForm";
import { AssignmentGridForm } from "@/components/rotations/AssignmentGridForm";
import {
  syncRotation,
  addRotationMember,
  removeRotationMember,
  moveRotationMember,
} from "@/app/rotations/actions";
import type { MeetingTypeSlug } from "@/lib/types";

const ELEMENT_LABELS: Record<string, string> = {
  conducting: "Conducting",
  opening_prayer: "Opening Prayer",
  closing_prayer: "Closing Prayer",
  chorister: "Chorister",
  organist: "Organist",
  spiritual_thought: "Spiritual Thought",
  handbook_training: "Handbook Training",
};

// Presiding/Conducting are fixed by calling (Bishop -> 1st Counselor ->
// 2nd Counselor, cycling by calendar month -- see
// applyFixedSacramentRoles in lib/data/rotations.ts), not driven by a
// rotation_members list at all. Any leftover `rotations` row for either
// is inert -- applyRotationsToNewMeeting explicitly skips 'conducting'
// for Sacrament Meeting -- and showing it here as if it were a normal
// editable rotation is exactly the kind of thing that reads as "only
// pulling one person" when the real cause is upstream (see the grid's
// own note below).
const FIXED_BY_CALLING_KEYS = new Set(["presiding", "conducting"]);

const MEETING_TYPE_TABS: { slug: MeetingTypeSlug; label: string }[] = [
  { slug: "sacrament-meeting", label: "Sacrament Meeting" },
  { slug: "bishopric-meeting", label: "Bishopric Meeting" },
  { slug: "ward-council", label: "Ward Council" },
  { slug: "youth-council", label: "Youth Council" },
];

function defaultThroughDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().slice(0, 10);
}

function TypeTab({ slug, active, label }: { slug: MeetingTypeSlug; active: boolean; label: string }) {
  return (
    <Link
      href={`/rotations?type=${slug}`}
      className={[
        "rounded-md px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors",
        active ? "bg-ink text-paper" : "text-ink-muted hover:text-ink",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

function RotationCard({ rotation, people }: { rotation: RotationRow; people: PersonOption[] }) {
  const sync = async () => {
    "use server";
    await syncRotation(rotation.id);
  };
  const addMember = async (formData: FormData) => {
    "use server";
    await addRotationMember(rotation.id, formData);
  };

  const memberIds = new Set(rotation.members.map((m) => m.person_id));
  const availablePeople = people.filter((p) => !memberIds.has(p.id));
  const nextUpName = rotation.members[rotation.next_index % Math.max(rotation.members.length, 1)]?.person_name;

  return (
    <div className="rounded-lg border border-rule bg-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl">{ELEMENT_LABELS[rotation.element_key] ?? rotation.element_key}</h2>
          <p className="text-xs text-ink-muted">{rotation.meeting_type_name}</p>
        </div>
        {rotation.eligibility_source !== "manual" && (
          <form action={sync}>
            <button type="submit" className="text-xs text-ink-muted hover:text-ink">
              Sync from {rotation.eligibility_source === "calling_names" ? "callings" : "standing attendees"}
            </button>
          </form>
        )}
      </div>

      {rotation.members.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">No one in this rotation yet.</p>
      ) : (
        <>
          <p className="mt-4 text-xs text-ink-muted">
            Next up: <span className="text-ink">{nextUpName}</span>
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {rotation.members.map((m, idx) => {
              const remove = async () => {
                "use server";
                await removeRotationMember(m.id);
              };
              const moveUp = async () => {
                "use server";
                await moveRotationMember(rotation.id, m.id, "up");
              };
              const moveDown = async () => {
                "use server";
                await moveRotationMember(rotation.id, m.id, "down");
              };
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-rule/60 px-3 py-1.5 text-sm"
                >
                  <span className={idx === rotation.next_index % rotation.members.length ? "text-ink" : "text-ink-muted"}>
                    {m.person_name}
                  </span>
                  <span className="flex items-center gap-2">
                    <form action={moveUp}>
                      <button type="submit" disabled={idx === 0} className="text-xs text-ink-muted hover:text-ink disabled:opacity-30">
                        &uarr;
                      </button>
                    </form>
                    <form action={moveDown}>
                      <button
                        type="submit"
                        disabled={idx === rotation.members.length - 1}
                        className="text-xs text-ink-muted hover:text-ink disabled:opacity-30"
                      >
                        &darr;
                      </button>
                    </form>
                    <form action={remove}>
                      <button type="submit" className="text-xs text-ink-muted hover:text-ink">
                        Remove
                      </button>
                    </form>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {availablePeople.length > 0 && (
        <form action={addMember} className="mt-4 flex items-center gap-2">
          <select name="person_id" defaultValue="" className="flex-1 rounded-md border border-rule bg-paper px-2 py-1.5 text-xs text-ink">
            <option value="" disabled>
              Add someone&hellip;
            </option>
            {availablePeople.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper hover:bg-ink/90">
            Add
          </button>
        </form>
      )}

      {rotation.members.length > 0 && <PushRotationForm rotationId={rotation.id} />}
    </div>
  );
}

export default async function RotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; through?: string }>;
}) {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Assignment Rotations" />
        <p className="mt-10 text-ink-muted">Only the Bishopric can manage assignment rotations.</p>
      </main>
    );
  }

  const { type: rawType, through: rawThrough } = await searchParams;
  const selectedType: MeetingTypeSlug = MEETING_TYPE_TABS.some((t) => t.slug === rawType)
    ? (rawType as MeetingTypeSlug)
    : "sacrament-meeting";
  const throughDate = rawThrough || defaultThroughDate();

  const [rotations, people, grid] = await Promise.all([
    getAllRotations(),
    getActivePeople(),
    getAssignmentGrid(selectedType, throughDate),
  ]);

  const visibleRotations = rotations.filter((r) => !FIXED_BY_CALLING_KEYS.has(r.element_key));

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Assignment Rotations" />

      <Link href="/meeting-planning" className="text-xs text-ink-muted hover:text-ink">
        &larr; Meeting Planning
      </Link>

      <section className="mt-4">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">Assignment Rotations</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Every upcoming meeting down one side, every role across the top &mdash; fill in who&rsquo;s
          actually assigned. This is the real, applied assignment for that meeting, however it got
          there (a fixed calling order, a rotation, or a manual pick) &mdash; editing a cell here
          never changes whose turn is next for the rotations below, it only overrides this one
          meeting.
        </p>
      </section>

      <div className="flex w-fit flex-wrap gap-1 rounded-md border border-rule p-1">
        {MEETING_TYPE_TABS.map((t) => (
          <TypeTab key={t.slug} slug={t.slug} active={t.slug === selectedType} label={t.label} />
        ))}
      </div>

      <div className="rounded-lg border border-rule bg-surface p-6">
        <form method="get" className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="type" value={selectedType} />
          <label className="text-xs text-ink-muted">
            Through
            <input
              type="date"
              name="through"
              defaultValue={throughDate}
              className="ml-2 rounded-md border border-rule bg-paper px-2 py-1.5 text-xs text-ink"
            />
          </label>
          <button type="submit" className="rounded-md border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5">
            Update range
          </button>
        </form>

        {selectedType === "sacrament-meeting" && (
          <p className="mt-3 text-[11px] text-ink-muted/60">
            No Presiding column &mdash; it always defaults to whoever holds the Bishop calling.
            Conducting cycles automatically by calendar month (Bishop &rarr; 1st Counselor &rarr; 2nd
            Counselor) based on who currently holds each calling &mdash; if it shows the same person
            every month, check that both counselor callings actually have a current holder set
            (Table Admin &rarr; Callings). The dropdown itself already only offers whichever of the
            three currently has a holder.
          </p>
        )}

        {grid.rows.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            No {MEETING_TYPE_TABS.find((t) => t.slug === selectedType)?.label} meetings scheduled in
            this range yet.
          </p>
        ) : (
          <AssignmentGridForm meetingTypeSlug={selectedType} columns={grid.columns} rows={grid.rows} />
        )}
      </div>

      <section className="mt-2">
        <h2 className="font-display text-xl">Rotation Order</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Whoever&rsquo;s next gets pre-filled automatically when a new meeting is created. This is
          secondary to the grid above -- it only sets the *default* for a meeting that doesn&rsquo;t
          have one yet, or after everyone above has had a turn. Presiding and Conducting aren&rsquo;t
          configured here at all (fixed by calling -- see the note above).
        </p>
      </section>

      <div className="flex flex-col gap-4">
        {visibleRotations.map((r) => (
          <RotationCard key={r.id} rotation={r} people={people} />
        ))}
      </div>
    </main>
  );
}
