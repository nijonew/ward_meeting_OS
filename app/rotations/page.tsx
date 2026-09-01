import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getAllRotations, type RotationRow } from "@/lib/data/rotations";
import { getActivePeople } from "@/lib/data/people";
import { syncRotation, addRotationMember, removeRotationMember, moveRotationMember } from "@/app/rotations/actions";

const ELEMENT_LABELS: Record<string, string> = {
  conducting: "Conducting",
  opening_prayer: "Opening Prayer",
  closing_prayer: "Closing Prayer",
  chorister: "Chorister",
  organist: "Organist",
  spiritual_thought: "Spiritual Thought",
  handbook_training: "Handbook Training",
};

function RotationCard({ rotation, people }: { rotation: RotationRow; people: { id: string; name: string }[] }) {
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
    <div className="rounded-lg border border-rule bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl">{ELEMENT_LABELS[rotation.element_key] ?? rotation.element_key}</h2>
          <p className="text-xs text-slate">{rotation.meeting_type_name}</p>
        </div>
        {rotation.eligibility_source !== "manual" && (
          <form action={sync}>
            <button type="submit" className="text-xs text-slate hover:text-ink">
              Sync from {rotation.eligibility_source === "calling_names" ? "callings" : "standing attendees"}
            </button>
          </form>
        )}
      </div>

      {rotation.members.length === 0 ? (
        <p className="mt-4 text-sm text-slate">No one in this rotation yet.</p>
      ) : (
        <>
          <p className="mt-4 text-xs text-slate">
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
                  <span className={idx === rotation.next_index % rotation.members.length ? "text-ink" : "text-slate"}>
                    {m.person_name}
                  </span>
                  <span className="flex items-center gap-2">
                    <form action={moveUp}>
                      <button type="submit" disabled={idx === 0} className="text-xs text-slate hover:text-ink disabled:opacity-30">
                        &uarr;
                      </button>
                    </form>
                    <form action={moveDown}>
                      <button
                        type="submit"
                        disabled={idx === rotation.members.length - 1}
                        className="text-xs text-slate hover:text-ink disabled:opacity-30"
                      >
                        &darr;
                      </button>
                    </form>
                    <form action={remove}>
                      <button type="submit" className="text-xs text-slate hover:text-ink">
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
    </div>
  );
}

export default async function RotationsPage() {
  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  if (profile?.role !== "bishopric") {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12 sm:px-8">
        <AppHeader tag="Assignment Rotations" />
        <p className="mt-10 text-slate">Only the Bishopric can manage assignment rotations.</p>
      </main>
    );
  }

  const [rotations, people] = await Promise.all([getAllRotations(), getActivePeople()]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12 sm:px-8">
      <AppHeader tag="Assignment Rotations" />

      <section className="mt-4">
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">Assignment Rotations</h1>
        <p className="mt-2 text-sm text-slate">
          Whoever&rsquo;s next gets pre-filled automatically when a new meeting is created. Overriding
          it for one meeting doesn&rsquo;t change whose turn is next.
        </p>
      </section>

      <div className="flex flex-col gap-4">
        {rotations.map((r) => (
          <RotationCard key={r.id} rotation={r} people={people} />
        ))}
      </div>
    </main>
  );
}