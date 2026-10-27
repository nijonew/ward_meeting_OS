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
import { getSessionUser, hasFeature } from "@/lib/supabase/get-session-user";
import { meetingFeature } from "@/lib/data/meeting-features";
import { getVisibleMeetingTypesForUser } from "@/lib/data/meeting-type-access";
import { getAnnouncementsByPlannedElement, type PulledAnnouncement } from "@/lib/data/sacrament-announcements";
import { splitIntoSections } from "@/lib/data/agenda-rows";
import { getAnnouncementsForMeetingReview, getPreviousMeetingMinutes } from "@/lib/data/meeting-review";
import { getTitlePrefixesForAssignments, formatTitleLastName } from "@/lib/data/person-display";

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

const NOTE_BOX = "rounded border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-ink";
const ROW = "rounded border border-rule/60 p-3";
const LABEL = "font-mono text-[11px] uppercase tracking-wider text-ink-muted/70";

function personName(
  people: PersonOption[],
  id: string | null | undefined,
  elementKey?: string,
  titlePrefixByKey?: Map<string, string>
): string | null {
  if (!id) return null;
  const name = people.find((p) => p.id === id)?.name;
  if (!name) return null;
  if (!elementKey || !titlePrefixByKey) return name;
  return formatTitleLastName(name, titlePrefixByKey.get(`${elementKey}::${id}`));
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
  return <p className="text-sm text-ink-muted/50">None</p>;
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
    return <p className="text-ink-muted">Could not load this meeting.</p>;
  }

  // "isAdmin" here means "can edit this meeting," i.e. this specific
  // meeting type's own planning feature (2026-10-04, replacing a
  // single blanket "bishopric" check).
  const isAdmin = hasFeature(profile, meetingFeature(meeting.meetingType, "planning"));

  if (meeting.meetingType === "sacrament-meeting") {
    // Deliberate difference from the other three types (Vision
    // workflow, reaffirmed 2026-09-08): no calling-based access to a
    // Sacrament Meeting here at all -- its live view is the existing
    // public program, and archived stays admin-only.
    if (!isAdmin) {
      return (
        <div className="rounded border border-rule bg-surface p-6">
          <p className="text-sm text-ink-muted">
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
        <div className="rounded border border-rule bg-surface p-6">
          <p className="text-sm text-ink-muted">
            This meeting hasn&rsquo;t been archived yet. It&rsquo;s still editable from{" "}
            <Link href={`/meetings/${meetingId}/planning`} className="underline">
              Planning
            </Link>
            .
          </p>
        </div>
      );
    }
  } else {
    const hasAccess = isAdmin || (await getVisibleMeetingTypesForUser(user.id, profile?.features)).includes(meeting.meetingType);
    if (!hasAccess) {
      return (
        <div className="rounded border border-rule bg-surface p-6">
          <p className="text-sm text-ink-muted">You don&rsquo;t have access to view this meeting.</p>
        </div>
      );
    }
    // 2026-10-19: this used to require stage === "live" specifically --
    // a real, silent bug, since "live" was never actually reachable by
    // any code path (see lib/types.ts's own comment), so a non-admin
    // could never see this page before a meeting archived no matter
    // what. Now that the dead Live tab/stage is gone, a non-admin with
    // calling-based access sees this page any time the meeting has
    // moved past its bare just-created stub -- restoring the Vision
    // workflow's actual intent ("once live... can view it").
    if (meeting.stage === "template") {
      if (isAdmin) {
        return (
          <div className="rounded border border-rule bg-surface p-6">
            <p className="text-sm text-ink-muted">
              This meeting isn&rsquo;t being planned yet. Start from{" "}
              <Link href={`/meetings/${meetingId}/planning`} className="underline">
                Planning
              </Link>
              .
            </p>
          </div>
        );
      }
      return (
        <div className="rounded border border-rule bg-surface p-6">
          <p className="text-sm text-ink-muted">This meeting isn&rsquo;t available to view yet.</p>
        </div>
      );
    }
  }

  // Real-time meeting notes (Minutes/Action Items/Council Notes) are
  // hidden from a non-admin viewer until the meeting is archived, per
  // the Vision workflow -- the rest of the agenda (role assignments,
  // ward business, music, speakers, RABNM) is already visible the
  // moment a meeting goes live, so it isn't gated by this flag. Whoever
  // can plan the meeting can obviously also see its own notes, so this
  // checks both features (2026-10-04) -- planning implies notes, not
  // just the narrower `<type>_notes` feature alone.
  const showRealTimeNotes =
    isAdmin || hasFeature(profile, meetingFeature(meeting.meetingType, "notes")) || meeting.stage === "archived";

  const meetingWithType = await getMeetingWithType(meetingId);
  if (!meetingWithType) {
    return <p className="text-ink-muted">Could not load this meeting.</p>;
  }

  const isSacrament = meeting.meetingType === "sacrament-meeting";
  const isBishopric = meeting.meetingType === "bishopric-meeting";
  const isCouncil = meeting.meetingType === "ward-council" || meeting.meetingType === "youth-council";
  const roleTable = isSacrament ? "sacrament_assignments" : "bishopric_assignments";

  const [plannedElements, people, roleAssignments, elementNotes, sacramentData, announcementsByPlannedElement] = await Promise.all([
    getPlannedElements(meetingId),
    getActivePeople(),
    getRoleAssignments(meetingId, roleTable),
    getElementNotes(meetingId),
    isSacrament ? getSacramentPlanningData(meetingId) : Promise.resolve(null),
    isSacrament ? getAnnouncementsByPlannedElement(meetingId) : Promise.resolve(new Map<string, PulledAnnouncement[]>()),
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

  // "Title + last name" (2026-10-21) for any role resolved via a
  // calling -- see getTitlePrefixesForAssignments. Same approach as
  // Conducting's own getConductingRows: gather every elementKey/personId
  // pair this read-only view is about to render, then one batched query.
  const titlePairs: { elementKey: string; personId: string }[] = [];
  for (const el of templateElements) {
    if (isSacrament && el.key === "recognize_music") {
      for (const role of ["chorister", "organist"]) {
        const id = roleAssignments[role]?.assigned_to_id;
        if (id) titlePairs.push({ elementKey: role, personId: id });
      }
      continue;
    }
    if (el.resolution_kind === "person_role") {
      const id = roleAssignments[el.key]?.assigned_to_id;
      if (id) titlePairs.push({ elementKey: el.key, personId: id });
    } else if (el.resolution_kind === "person_and_text") {
      const id = elementNotes[el.key]?.person_id;
      if (id) titlePairs.push({ elementKey: el.key, personId: id });
    }
  }
  const titlePrefixByKey = await getTitlePrefixesForAssignments(meeting.meetingType, titlePairs);

  // Same sectioned layout as Planning (2026-10-19) -- see that page's
  // own comment and splitIntoSections's doc comment in agenda-rows.ts.
  const collaborativeSections = !isSacrament ? splitIntoSections(templateElements) : [];
  const [reviewAnnouncements, previousMinutes] = !isSacrament
    ? await Promise.all([
        getAnnouncementsForMeetingReview(meeting.meetingType),
        getPreviousMeetingMinutes(meeting.meetingType, meeting.date),
      ])
    : [[], null];

  const renderedMusicKinds = new Set<string>();
  const renderedSlotKinds = new Set<string>();

  function renderElement(el: TemplateElementRow) {
    // Recognize Music: Chorister + Organist together on one line, same
    // as Planning/Conducting render it -- catalogued as resolution_kind
    // 'none', so the generic switch below would otherwise just show the
    // bare label with nothing resolved. Falls back to each role's guest
    // name (migration 064, 2026-10-07) when no real person was assigned.
    // Checked before the switch for the same reason ward_business/
    // stake_business are (isSacrament && key === "recognize_music" in
    // lib/data/agenda-rows.ts).
    if (isSacrament && el.key === "recognize_music") {
      const choristerAssignment = roleAssignments["chorister"];
      const organistAssignment = roleAssignments["organist"];
      const chorister =
        personName(people, choristerAssignment?.assigned_to_id, "chorister", titlePrefixByKey) ?? choristerAssignment?.guest_name ?? null;
      const organist =
        personName(people, organistAssignment?.assigned_to_id, "organist", titlePrefixByKey) ?? organistAssignment?.guest_name ?? null;
      return (
        <Row key={el.id} label={el.label}>
          {chorister || organist ? (
            <Plain>
              {chorister ? `${chorister} (Chorister)` : null}
              {chorister && organist ? ", " : null}
              {organist ? `${organist} (Organist)` : null}
            </Plain>
          ) : (
            <Empty />
          )}
        </Row>
      );
    }

    // Announcements (2026-10-11) -- same reasoning as recognize_music
    // above: catalogued as resolution_kind 'none', so without this the
    // generic switch below would just show the bare label with nothing
    // underneath, even though real data exists once any were pulled in.
    if (isSacrament && el.key === "announcements") {
      const announcements = announcementsByPlannedElement.get(el.id) ?? [];
      return (
        <Row key={el.id} label={el.label}>
          {announcements.length > 0 ? <Note>{announcements.map((a) => a.title).join(", ")}</Note> : <Empty />}
        </Row>
      );
    }

    // Review section content, split into two real elements (2026-10-27)
    // -- see lib/data/agenda-rows.ts's matching row kinds for the full
    // story. Both catalogued as resolution_kind 'none', so without this
    // the generic switch below would just show the bare label.
    if (!isSacrament && el.key === "review_announcements") {
      return (
        <Row key={el.id} label={el.label}>
          {reviewAnnouncements.length > 0 ? (
            <div className="flex flex-col gap-2">
              {reviewAnnouncements.map((a) => (
                <div key={a.id}>
                  <Plain>{a.title}</Plain>
                  {a.body && <Note>{a.body}</Note>}
                </div>
              ))}
            </div>
          ) : (
            <Empty />
          )}
        </Row>
      );
    }
    if (!isSacrament && el.key === "previous_meeting_minutes") {
      return (
        <Row key={el.id} label={el.label}>
          {previousMinutes ? <Note>{previousMinutes.text}</Note> : <Empty />}
        </Row>
      );
    }

    switch (el.resolution_kind) {
      case "person_role": {
        const name = personName(people, roleAssignments[el.key]?.assigned_to_id, el.key, titlePrefixByKey);
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
        const displayName =
          note?.person_name && note?.person_id
            ? formatTitleLastName(note.person_name, titlePrefixByKey.get(`${el.key}::${note.person_id}`))
            : note?.person_name ?? null;
        return (
          <Row key={el.id} label={el.label}>
            {displayName && <Plain>{displayName}</Plain>}
            {note?.text_value ? <Note>{note.text_value}</Note> : !displayName && <Empty />}
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
        // Agenda Items now renders at its own real template position,
        // 2026-10-11 (the user's own report, going into a live
        // Bishopric/Ward Council/Youth Council meeting: "the agenda
        // items come in at the end of the meeting... it didn't follow
        // the template") -- the matching read-only-view version of the
        // same bug just fixed on the live Planning page. This used to
        // return null here and defer to a fixed section at the very
        // bottom of the page regardless of where agenda_items actually
        // sits in the template; now it renders inline, in place, same
        // as every other element. No nested-<form> concern here at
        // all (unlike Planning) -- this whole page is read-only.
        if (el.key === "agenda_items") {
          return (
            <div key={el.id} className={ROW}>
              <p className={LABEL}>{el.label}</p>
              {agendaItems.length > 0 ? (
                <div className="mt-2 flex flex-col gap-2">
                  {agendaItems.map((item) => (
                    <div key={item.id}>
                      <p className="text-sm text-ink">
                        {item.title} &middot; {item.submitted_by_name}
                      </p>
                      {item.body && <Note>{item.body}</Note>}
                      {item.notes && <Note>{item.notes}</Note>}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty />
              )}
            </div>
          );
        }
        return (
          <div key={el.id} className={ROW}>
            <p className="text-sm text-ink">{el.label}</p>
          </div>
        );
      }
    }
  }

  const elementFields = isSacrament ? templateElements.map(renderElement).filter(Boolean) : [];

  const musicRows = sacramentData?.music ?? [];
  const speakerRows = [
    ...(renderedSlotKinds.has("speaker") ? sacramentData?.speakersAdults ?? [] : []),
    ...(renderedSlotKinds.has("youth_speaker") ? sacramentData?.speakersYouth ?? [] : []),
  ].filter((s) => s.speaker_id || s.guest_speaker_name);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded border border-accent/40 bg-accent/5 p-4 text-xs text-ink-muted">
        {meeting.stage === "archived"
          ? "Archived. This is the finalized agenda as it was when the meeting ended."
          : "This meeting is live. The agenda below can still change."}{" "}
        Highlighted boxes are notes/content admins entered; everything else is the agenda itself.
        {!showRealTimeNotes && " Meeting notes and minutes become visible here once this meeting is archived."}
      </div>

      {meeting.cancelled && (
        <div className="rounded border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          This meeting was cancelled{meeting.cancellationNote ? `: ${meeting.cancellationNote}` : "."}
        </div>
      )}

      {templateElements.length === 0 ? (
        <div className="rounded border border-rule bg-surface p-6">
          <p className="text-sm text-ink-muted">No agenda elements were recorded for this meeting.</p>
        </div>
      ) : isSacrament ? (
        <div className="rounded border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Agenda</h2>
          <div className="mt-4 flex flex-col gap-2">{elementFields}</div>
        </div>
      ) : (
        <div className="rounded border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Agenda</h2>
          <div className="mt-4 flex flex-col gap-6">
            {collaborativeSections.map((section, i) => {
              // Review's own content used to need its own special case
              // here (a hardcoded ReviewSection block) -- now that
              // Announcements and Previous Meeting Minutes are real
              // elements (2026-10-27), this generic branch already
              // renders them correctly in order, same as any other
              // section.
              const rendered = section.elements.map(renderElement).filter(Boolean);
              if (rendered.length === 0) return null;

              return (
                <div key={`section-${i}`} className="border-t-2 border-rule pt-4 first:border-t-0 first:pt-0">
                  {section.label && (
                    <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">
                      {section.label}
                    </span>
                  )}
                  <div className="mt-3 flex flex-col gap-2">{rendered}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isSacrament && musicRows.length > 0 && (
        <div className="rounded border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Music</h2>
          <div className="mt-4 flex flex-col gap-2">
            {musicRows.map((m) => (
              <div key={m.id} className={ROW}>
                <p className={LABEL}>{m.type.replace(/_/g, " ")}</p>
                <Plain>
                  {m.hymn_number ? `#${m.hymn_number}` : ""} {m.piece_name ?? ""}
                  {m.individual_name ? ` · ${m.individual_name}` : ""}
                  {m.group_name ? ` · ${m.group_name}` : ""}
                  {m.accompanist_name ? ` (accompanied by ${m.accompanist_name})` : ""}
                </Plain>
              </div>
            ))}
          </div>
        </div>
      )}

      {isSacrament && speakerRows.length > 0 && (
        <div className="rounded border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Speakers</h2>
          <div className="mt-4 flex flex-col gap-2">
            {speakerRows.map((s, i) => (
              <div key={`${s.slot}-${i}`} className={ROW}>
                <Plain>{s.guest_speaker_name || personName(people, s.speaker_id) || "Unnamed"}</Plain>
                {s.topic && <Note>{s.topic}</Note>}
              </div>
            ))}
          </div>
        </div>
      )}

      {isSacrament && sacramentData && sacramentData.rabnm.length > 0 && (
        <div className="rounded border border-rule bg-surface p-6">
          <h2 className="font-display text-xl">Recognitions / Advancements / Baptisms / New Members</h2>
          <div className="mt-4 flex flex-col gap-2">
            {sacramentData.rabnm.map((r) => (
              <div key={r.id} className={ROW}>
                <p className={LABEL}>{r.type.replace(/_/g, " ")}</p>
                <Plain>{[r.calling_name, ...r.people].filter(Boolean).join(" · ") || "None"}</Plain>
                {r.detail && <Note>{r.detail}</Note>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showRealTimeNotes && isBishopric && bishopricData?.minutes && (
        <div className="rounded border border-rule bg-surface p-6">
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
        <div className="rounded border border-rule bg-surface p-6">
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
        <div className="rounded border border-rule bg-surface p-6">
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

    </div>
  );
}
