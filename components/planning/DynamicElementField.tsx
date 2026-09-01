import { saveElementPersonRole, saveElementNote } from "@/app/meetings/[id]/dynamic-planning-actions";
import type { PersonOption } from "@/lib/data/people";
import type { RoleAssignmentValue } from "@/lib/data/meeting-elements";
import type { ElementNoteValue } from "@/lib/data/meeting-element-notes";

const FIELD_WRAPPER = "rounded-md border border-rule/60 p-3";
const LABEL = "font-mono text-[11px] uppercase tracking-widest text-slate/70";
const SELECT = "mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink";
const TEXTAREA = "mt-1 block w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink";
const SAVE_BTN =
  "mt-2 rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-ink/90";

function PersonSelect({
  name,
  people,
  defaultValue,
}: {
  name: string;
  people: PersonOption[];
  defaultValue: string | null;
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} className={SELECT}>
      <option value="">&mdash; Unassigned &mdash;</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

export function PersonRoleField({
  meetingId,
  elementKey,
  label,
  table,
  people,
  value,
}: {
  meetingId: string;
  elementKey: string;
  label: string;
  table: "sacrament_assignments" | "bishopric_assignments";
  people: PersonOption[];
  value: RoleAssignmentValue | undefined;
}) {
  const save = async (formData: FormData) => {
    "use server";
    await saveElementPersonRole(meetingId, elementKey, table, formData);
  };

  return (
    <form action={save} className={FIELD_WRAPPER}>
      <p className={LABEL}>{label}</p>
      <PersonSelect name="assigned_to_id" people={people} defaultValue={value?.assigned_to_id ?? null} />
      {table === "sacrament_assignments" && (
        <label className="mt-2 flex items-center gap-1.5 text-xs text-slate">
          <input type="checkbox" name="confirmed" defaultChecked={value?.confirmed ?? false} />
          Confirmed
        </label>
      )}
      <button type="submit" className={SAVE_BTN}>
        Save
      </button>
    </form>
  );
}

export function FreeTextField({
  meetingId,
  elementKey,
  label,
  value,
}: {
  meetingId: string;
  elementKey: string;
  label: string;
  value: ElementNoteValue | undefined;
}) {
  const save = async (formData: FormData) => {
    "use server";
    await saveElementNote(meetingId, elementKey, formData);
  };

  return (
    <form action={save} className={FIELD_WRAPPER}>
      <p className={LABEL}>{label}</p>
      <textarea name="text_value" defaultValue={value?.text_value ?? ""} rows={3} className={TEXTAREA} />
      <button type="submit" className={SAVE_BTN}>
        Save
      </button>
    </form>
  );
}

export function PersonAndTextField({
  meetingId,
  elementKey,
  label,
  people,
  value,
}: {
  meetingId: string;
  elementKey: string;
  label: string;
  people: PersonOption[];
  value: ElementNoteValue | undefined;
}) {
  const save = async (formData: FormData) => {
    "use server";
    await saveElementNote(meetingId, elementKey, formData);
  };

  return (
    <form action={save} className={FIELD_WRAPPER}>
      <p className={LABEL}>{label}</p>
      <PersonSelect name="person_id" people={people} defaultValue={value?.person_id ?? null} />
      <textarea
        name="text_value"
        defaultValue={value?.text_value ?? ""}
        rows={3}
        placeholder="Notes"
        className={`${TEXTAREA} mt-2`}
      />
      <button type="submit" className={SAVE_BTN}>
        Save
      </button>
    </form>
  );
}

export function LabelOnlyField({ label, note }: { label: string; note?: string }) {
  return (
    <div className={`${FIELD_WRAPPER} flex items-center justify-between`}>
      <p className="text-sm text-ink">{label}</p>
      {note && <p className="text-xs text-slate/60">{note}</p>}
    </div>
  );
}