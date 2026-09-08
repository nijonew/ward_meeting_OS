import Link from "next/link";
import { redirect } from "next/navigation";
import { getMeetingById } from "@/lib/data/meetings";
import {
  getMeetingWithType,
  getTemplateElements,
  getPlannedElements,
  getRoleAssignments,
  type TemplateElementRow,
} from "@/lib/data/meeting-elements";
import { getElementNotes, type ElementNoteValue } from "@/lib/data/meeting-element-notes";
import { getSacramentPlanningData } from "@/lib/data/sacrament-planning";
import { getActivePeople, type PersonOption } from "@/lib/data/people";
import { getBishopricMeetingData, getAgendaItemsForMeeting } from "@/lib/data/bishopric-meeting";
import { getCouncilNotes } from "@/lib/data/council-notes";
import { getSessionUser } from "@/lib/supabase/get-session-user";
import { getVisibleMeetingTypesForUser } from "@/lib/data/meeting-type-access";

/**
 * Read-only meeting view -- built 2026-09-08 to be the calling-based
 * non-admin viewer the Vision workflow describes ("once live, non-admin
 * members with read rights for that meeting by calling can view it...
 * admins can add notes... hidden from non-admin viewers while live,
 * visible once archived"), extending what was originally an
 * archived-only, admin-only page (see git history) per the user's own
 * decision to reuse this rather than build a second read-only renderer.
 *
 * Access, for Bishopric Meeting/Ward Council/Youth Council:
 * - Admins (bishopric role): always, any stage past template/planning/
 *   review/ready (redirected to Live to keep editing otherwise).
 * - Everyone else: only once `live` or `archived`, and only if their
 *   calling maps to this meeting type (meeting_type_members, the same
 *   mapping getVisibleMeetingTypesForUser already resolves for the
 *   landing page's "My meetings" tiles).
 *
 * Sacrament Meeting is deliberately NOT served here for non-admins --
 * per the user's own decision (2026-09-08), its live view is exactly
 * the existing public program (/meetings/[id]/public, no new content),
 * and its archived state stays admin-only, preserving the Vision
 * workflow's original "deliberate difference" from the other three
 * types.
 *
 * "Hidden while live, visible once archived" is scoped narrowly on
 * purpose: only the Minutes/Action Items/Council Notes sections
 * (real-time, admin-only-while-live content per the workflow) are
 * suppressed for a non-admin viewer before archiving. The agenda
 * itself -- role assignments, ward business, music, speakers, RABNM --
 * already becomes visible the moment a meeting goes live, per that same
 * workflow's own wording ("once live... can view it"), so none of that
 * waits for archiving. Revisit this split if it turns out wrong once
 * the bigger meeting-display redesign (still to be discussed) lands.
 *
 * Deliberately a parallel read-only renderer, not a "disable the
 * inputs" mode over the same components Planning uses -- those ARE the
 * editing forms; this reads the exact same already-existing data
 * layer (getRoleAssignments, getElementNotes, getSacramentPlanningData,
 * etc.) and resolves each element to plain text instead.
 */

const NOTE_BOX = "rounded-md border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-ink";
const ROW = "rounded-md border border-rule/60 p-3";
const LABEL = "font-mono text-[11px] uppercase tracking-widest text-slate/70";

function personName(people: PersonOption[], id: string | null | undefined): string | null {
  if (!id) return null;
  return people.find((p) => p.id === id)?.name ?? null;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={ROW}>
      <p className={LABEL}>{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className={`mt-1 ${NOTE_BOX}`}>{children}</div>;
}

function Plain({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ink">{children}</p>;
}

function Empty() {
  return <p className="text-sm text-slate/50">&mdash; none &mdash;</p>;
}

export default async function ArchivedMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: meetingId } = await params;

  const { user, profile } = await getSessionUser();
  if (!user) redirect("/login");

  const meeting = await getMeetingById(meetingId);
  if (!meeting) {
    return <p className="text-slate">Could not load this meeting.</p>;
  }

  const isAdmin = profile?.role === "bishopric";

  if (meeting.meetingType === "sacrament-meeting") {
    // Deliberate difference from the other three types (Vision
    // workflow, reaffirmed 2026-09-08): no calling-based access to a
    // Sacrament Meeting here at all -- its live view is the existing
    // public program, and archived stays admin-only.
    if (!isAdmin) {
      return (
        <div className="rounded-lg border border-rule bg-card p-6">
          <p className="text-sm text-slate">
            This meeting&rsquo;s program is available at its{" "}
            <Link href={`/meetings/${meetingId}/public`} className="underline">
              public page
            </Link>{" "}
            while it&rsquo;s live. Archived Sacrament Meetings are admin-only.
          </p>
        </div>
      );
    }
    if (meeting.stage !== "archived") {
      return (
        <div className="rounded-lg border border-rule bg-card p-6">
          <p className="text-sm text-slate">
            This meeting hasn&rsquo;t been archived yet &mdash; it&rsquo;s still editable from{" "}
            <Link href={`/meetings/${meetingId}/planning`} className="underline">
              Planning
            </Link>
            .
          </p>
        </div>
      );
    }
  } else {
    const hasAccess = isAdmin || (await getVisibleMeetingTypesForUser(user.id)).includes(meeting.meetingType);
    if (!hasAccess) {
      return (
        <div className="rounded-lg border border-rule bg-card p-6">
          <p className="text-sm text-slate">You don&rsquo;t have access to view this meeting.</p>
        </div>
      );
    }
    if (meeting.stage !== "live" && meeting.stage !== "archived") {
      if (isAdmin) {
        return (
          <div className="rounded-lg border border-rule bg-card p-6">
            <p className="text-sm text-slate">
              This meeting isn&rsquo;t live yet &mdash; it&rsquo;s still editable from{" "}
              <Link href={`/meetings/${meetingId}/live`} className="underline">
                Live
              </Link>
              .
            </p>
          </div>
        );
      }
      return (
        <div className="rounded-lg border border-rule bg-card p-6">
          <p className="text-sm text-slate">This meeting isn&rsquo;t available to view yet.</p>
        </div>
      );
    }
  }

  // Real-time meeting notes (Minutes/Action Items/Council Notes) are
  // hidden from a non-admin viewer until the meeting is archived, per
  // the Vision workflow -- the rest of the agenda (role assignments,
  // ward business, music, speakers, RABNM) is already visible the
  // moment a meeting goes live, so it isn't gated by this flag.
  const showRealTimeNotes = isAdmin || meeting.stage === "archived";

  const meetingWithType = await getMeetingWithType(meetingId);
  if (!meetingWithType) {
    return <p className="text-slate">Could not load this meeting.</p>;
  }

  const isSacrament = meeting.meetingType === "sacrament-meeting";
  const isBishopric = meeting.meetingType === "bishopric-meeting";
  const isCouncil = meeting.meetingType === "ward-council" || meeting.meetingType === "youth-council";
  const roleTable = isSacrament ? "sacrament_assignments" : "bishopric_assignments";

  const [plannedElements, people, roleAssignments, elementNotes, sacramentData] = await Promise.all([
    getPlannedElements(meetingId),
    getActivePeople(),
    getRoleAssignments(meetingId, roleTable),
    getElementNotes(meetingId),
    isSacrament ? getSacramentPlanningData(meetingId) : Promise.resolve(null),
  ]);

  const templateElements =
    plannedElements.length > 0
      ? plannedElements
      : await getTemplateElements(
          meetingWithType.meetingTypeId,
          isSacrament ? sacramentData?.planning?.special_format ?? "standard" : null
        );

  const bishopricData = isBishopric ? await getBishopricMeetingData(meetingId) : null;
  const councilNotes = isCouncil ? await getCouncilNotes(meetingId) : null;
  const agendaItems = await getAgendaItemsForMeeting(meetingId);

  const renderedMusicKinds = new Set<string>();
  const renderedSlotKinds = new Set<string>();
  const renderedNoneKinds = new Set<string>();

  function renderElement(el: TemplateElementRow) {
    switch (el.resolution_kind) {
      case "person_role": {
        const name = personName(people, roleAssignments[el.key]?.assigned_to_id);
        return (
          <Row key={el.id} label={el.label}>
            {name ? <Plain>{name}</Plain> : <Empty />}
          </Row>
        );
      }

      case "free_text": {
        if (el.key === "ward_business" || el.key === "stake_business") {
          const text = el.key === "ward_business" ? sacramentData?.planning?.ward_business : sacramentData?.planning?.stake_business;
          return (
            <Row key={el.id} label={el.label}>
              {text ? <Note>{text}</Note> : <Empty />}
            </Row>
          );
        }
        const note: ElementNoteValue | undefined = elementNotes[el.key];
        return (
          <Row key={el.id} label={el.label}>
            {note?.text_value ? <Note>{note.text_value}</Note> : <Empty />}
          </Row>
        );
      }

      case "person_and_text": {
        const note: ElementNoteValue | undefined = elementNotes[el.key];
        return (
          <Row key={el.id} label={el.label}>
            {note?.person_name && <Plain>{note.person_name}</Plain>}
            {note?.text_value ? <Note>{note.text_value}</Note> : !note?.person_name && <Empty />}
          </Row>
        );
      }

      case "music":
        renderedMusicKinds.add(el.key);
        return null;

      case "person_slot":
        renderedSlotKinds.add(el.key);
        return null;

      case "none":
      default: {
        if (el.key === "agenda_items") {
          renderedNoneKinds.add(el.key);
          return null;
        }
        return (
          <div key={el.id} className={ROW}>
            <p className="text-sm text-ink">{el.label}</p>
          </div>
        );
      }
    }
  }

  const elementFields = templateElements.map(renderElement).filter(Boolean);

  const musicRows = sacramentData?.music ?? [];
  const speakerRows = [
    ...(renderedSlotKinds.has("speaker") ? sacramentData?.speakersAdults ?? [] : []),
    ...(renderedSlotKinds.has("youth_speaker") ? sacramentData?.speakersYouth ?? [] : []),
  ].filter((s) => s.speaker_id || s.guest_speaker_name);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-brass/40 bg-brass/5 p-4 text-xs text-slate">
        {meeting.stage === "archived"
          ? "Archived — this is the finalized agenda as it was when the meeting ended."
          : "This meeting is live — the agenda below can still change."}{" "}
        Highlighted boxes are notes/content admins entered; everything else is the agenda itself.
        {!showRealTimeNotes && " Meeting notes and minutes become visible here once this meeting is archived."}
      </div>

      {meeting.cancelled && (
        <div className="rounded-lg border border-red-900/30 bg-red-950/5 p-4 text-sm text-red-700">
          This meeting was cancelled{meeting.cancellationNote ? `: ${meeting.cancellationNote}` : "."}
        </div>
      )}

      {templateElements.length === 0 ? (
        <div className="rounded-lg border border-rule bg-card p-6">
          <p className="text-sm text-slate">No agenda elements were recorded for this meeting.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-rule bg-card p-6">
          <h2 className="font-display text-xl">Agenda</h2>
          <div className="mt-4 flex flex-col gap-2">{elementFields}</div>
        </div>
      )}

      {isSacrament && musicRows.length > 0 && (
        <div className="rounded-lg border border-rule bg-card p-6">
          <h2 className="font-display text-xl">Music</h2>
          <div className="mt-4 flex flex-col gap-2">
            {musicRows.map((m) => (
              <div key={m.id} className={ROW}>
                <p className={LABEL}>{m.type.replace(/_/g, " ")}</p>
                <Plain>
                  {m.hymn_number ? `#${m.hymn_number}` : ""} {m.piece_name ?? ""}
                  {m.individual_name ? ` — ${m.individual_name}` : ""}
                  {m.group_name ? ` — ${m.group_name}` : ""}
                  {m.accompanist_name ? ` (accompanied by ${m.accompanist_name})` : ""}
                </Plain>
              </div>
            ))}
          </div>
        </div>
      )}

      {isSacrament && speakerRows.length > 0 && (
        <div className="rounded-lg border border-rule bg-card p-6">
          <h2 className="font-display text-xl">Speakers</h2>
          <div className="mt-4 flex flex-col gap-2">
            {speakerRows.map((s, i) => (
              <div key={`${s.slot}-${i}`} className={ROW}>
                <Plain>{s.guest_speaker_name || personName(people, s.speaker_id) || "— unnamed —"}</Plain>
                {s.topic && <Note>{s.topic}</Note>}
              </div>
            ))}
          </div>
        </div>
      )}

      {isSacrament && sacramentData && sacramentData.rabnm.length > 0 && (
        <div className="rounded-lg border border-rule bg-card p-6">
          <h2 className="font-display text-xl">Recognitions / Advancements / Baptisms / New Members</h2>
          <div className="mt-4 flex flex-col gap-2">
            {sacramentData.rabnm.map((r) => (
              <div key={r.id} className={ROW}>
                <p className={LABEL}>{r.type.replace(/_/g, " ")}</p>
                <Plain>{[r.calling_name, ...r.people].filter(Boolean).join(" — ") || "—"}</Plain>
                {r.detail && <Note>{r.detail}</Note>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showRealTimeNotes && isBishopric && bishopricData?.minutes && (
        <div className="rounded-lg border border-rule bg-card p-6">
          <h2 className="font-display text-xl">Minutes</h2>
          <div className="mt-4 flex flex-col gap-2">
            {[
              { label: "Spiritual Thought", presenter: bishopricData.minutes.spiritual_thought_presenter_id, text: bishopricData.minutes.spiritual_thought_notes },
              { label: "Handbook Training", presenter: bishopricData.minutes.handbook_training_presenter_id, text: bishopricData.minutes.handbook_training_topic },
            ].map(
              (f) =>
                (f.text || f.presenter) && (
                  <Row key={f.label} label={f.label}>
                    {f.presenter && <Plain>{personName(people, f.presenter)}</Plain>}
                    {f.text && <Note>{f.text}</Note>}
                  </Row>
                )
            )}
            {[
              { label: "Calendar Review", text: bishopricData.minutes.calendar_review_notes },
              { label: "Callings Discussion", text: bishopricData.minutes.callings_discussion_notes },
              { label: "Sacrament Meeting Review", text: bishopricData.minutes.sacrament_planning_discussion_notes },
              { label: "Young Men Coordination", text: bishopricData.minutes.young_men_coordination_notes },
              { label: "Impressions", text: bishopricData.minutes.impressions },
              { label: "General Minutes", text: bishopricData.minutes.minutes_body },
            ].map((f) => f.text && (
              <Row key={f.label} label={f.label}>
                <Note>{f.text}</Note>
              </Row>
            ))}
          </div>
        </div>
      )}

      {showRealTimeNotes && isBishopric && bishopricData && bishopricData.actionItems.length > 0 && (
        <div className="rounded-lg border border-rule bg-card p-6">
          <h2 className="font-display text-xl">Action Items</h2>
          <div className="mt-4 flex flex-col gap-2">
            {bishopricData.actionItems.map((item) => (
              <div key={item.id} className={ROW}>
                <p className={LABEL}>
                  {item.assigned_to_name ?? "Unassigned"}
                  {item.due_date ? ` · Due ${item.due_date}` : ""}
                  {item.completed ? " · Done" : ""}
                </p>
                <Note>{item.description}</Note>
              </div>
            ))}
          </div>
        </div>
      )}

      {showRealTimeNotes && isCouncil && (councilNotes?.notes || councilNotes?.next_meeting_date) && (
        <div className="rounded-lg border border-rule bg-card p-6">
          <h2 className="font-display text-xl">Council Notes</h2>
          <div className="mt-4 flex flex-col gap-2">
            {councilNotes?.notes && (
              <Row label="Notes">
                <Note>{councilNotes.notes}</Note>
              </Row>
            )}
            {councilNotes?.next_meeting_date && (
              <Row label="Next Meeting">
                <Plain>{councilNotes.next_meeting_date}</Plain>
              </Row>
            )}
          </div>
        </div>
      )}

      {renderedNoneKinds.has("agenda_items") && agendaItems.length > 0 && (
        <div className="rounded-lg border border-rule bg-card p-6">
          <h2 className="font-display text-xl">Agenda Items</h2>
          <div className="mt-4 flex flex-col gap-2">
            {agendaItems.map((item) => (
              <div key={item.id} className={ROW}>
                <p className={LABEL}>{item.title} &middot; {item.submitted_by_name}</p>
                {item.body && <Note>{item.body}</Note>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
