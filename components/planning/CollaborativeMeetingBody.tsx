"use client";

import { useCombinedSave } from "@/lib/hooks/use-combined-save";
import { AgendaGridForm } from "@/components/planning/AgendaGridForm";
import { AgendaItemsSection } from "@/components/bishopric/AgendaItemsSection";
import { BishopricMinutesForm } from "@/components/bishopric/BishopricMinutesForm";
import { ActionItemsSection } from "@/components/bishopric/ActionItemsSection";
import { CouncilNotesForm } from "@/components/council/CouncilNotesForm";
import type { AgendaRow } from "@/lib/data/agenda-rows";
import type { AgendaItemRow, BishopricMinutes, ActionItemRow } from "@/lib/data/bishopric-meeting";
import type { CouncilNotes } from "@/lib/data/council-notes";
import type { PersonOption } from "@/lib/data/people";
import type { HymnalIndexEntry } from "@/lib/data/hymnal-shared";

export interface CollaborativeSectionData {
  label: string | null;
  beforeRows: AgendaRow[];
  hasAgendaItems: boolean;
  afterRows: AgendaRow[];
}

/**
 * One combined "Save All Changes" button for Bishopric Meeting/Ward
 * Council/Youth Council's entire Planning page (2026-11-01, the user's
 * own report: "the meetings have too many instances of the save all
 * changes button"). This meeting type's own sections can produce
 * anywhere from one to several independent `AgendaGridForm`s (the
 * Discussion section alone splits into a "before"/"after" pair around
 * Agenda Items), on top of `BishopricMinutesForm`/`CouncilNotesForm`'s
 * own separate buttons -- this generalizes `CombinedAgendaGrids.tsx`'s
 * fixed two-grid design (built for Sacrament Meeting's opening/closing
 * split) to however many forms this meeting actually has, via
 * `useCombinedSave` (`lib/hooks/use-combined-save.ts`).
 *
 * `ActionItemsSection` is deliberately NOT part of this combine -- it
 * has no bulk-save button at all (Add/Mark done both commit
 * immediately, same as every other add/remove list in this app), so
 * there was nothing there to fold in.
 *
 * `buildAgendaRows` itself still runs server-side, in the Planning
 * page -- `sections` arrives here as already-resolved `AgendaRow[]`
 * data (plain, serializable), the same way `AgendaGridForm` has always
 * received its own `rows` prop; this component only owns the combined-
 * save orchestration and the actual rendering.
 */
export function CollaborativeMeetingBody({
  meetingId,
  roleTable,
  people,
  hymnalIndex,
  sections,
  agendaItems,
  isBishopric,
  bishopricMinutes,
  actionItems,
  isCouncil,
  councilNotes,
}: {
  meetingId: string;
  roleTable: "sacrament_assignments" | "bishopric_assignments";
  people: PersonOption[];
  hymnalIndex: HymnalIndexEntry[];
  sections: CollaborativeSectionData[];
  agendaItems: AgendaItemRow[];
  isBishopric: boolean;
  bishopricMinutes: BishopricMinutes | null;
  actionItems: ActionItemRow[];
  isCouncil: boolean;
  councilNotes: CouncilNotes | null;
}) {
  const formIds: string[] = [];
  sections.forEach((section, i) => {
    if (section.beforeRows.length > 0) formIds.push(`section-${i}-before`);
    if (section.afterRows.length > 0) formIds.push(`section-${i}-after`);
  });
  if (isBishopric) formIds.push("bishopric-minutes");
  if (isCouncil) formIds.push("council-notes");

  const { dirty, pending, error, allSaved, onDirtyChangeFor, onStateChangeFor, handleSaveAll } = useCombinedSave(formIds);

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section, i) => (
        <div key={`section-${i}`} className="border-t-2 border-rule pt-6 first:border-t-0 first:pt-0">
          {section.label && (
            <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted/70">{section.label}</span>
          )}
          <div className="mt-3 flex flex-col gap-4">
            {section.beforeRows.length > 0 && (
              <AgendaGridForm
                meetingId={meetingId}
                roleTable={roleTable}
                rows={section.beforeRows}
                people={people}
                hymnalIndex={hymnalIndex}
                formId={`section-${i}-before`}
                hideActions
                onDirtyChange={onDirtyChangeFor(`section-${i}-before`)}
                onStateChange={onStateChangeFor(`section-${i}-before`)}
              />
            )}
            {section.hasAgendaItems && <AgendaItemsSection meetingId={meetingId} items={agendaItems} />}
            {section.afterRows.length > 0 && (
              <AgendaGridForm
                meetingId={meetingId}
                roleTable={roleTable}
                rows={section.afterRows}
                people={people}
                hymnalIndex={hymnalIndex}
                formId={`section-${i}-after`}
                hideActions
                onDirtyChange={onDirtyChangeFor(`section-${i}-after`)}
                onStateChange={onStateChangeFor(`section-${i}-after`)}
              />
            )}
          </div>
        </div>
      ))}

      {isBishopric && (
        <>
          <BishopricMinutesForm
            meetingId={meetingId}
            minutes={bishopricMinutes}
            formId="bishopric-minutes"
            hideActions
            onDirtyChange={onDirtyChangeFor("bishopric-minutes")}
            onStateChange={onStateChangeFor("bishopric-minutes")}
          />
          <ActionItemsSection meetingId={meetingId} items={actionItems} people={people} />
        </>
      )}

      {isCouncil && (
        <CouncilNotesForm
          meetingId={meetingId}
          notes={councilNotes}
          formId="council-notes"
          hideActions
          onDirtyChange={onDirtyChangeFor("council-notes")}
          onStateChange={onStateChangeFor("council-notes")}
        />
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={!dirty || pending}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving..." : "Save All Changes"}
        </button>
        {error && <p className="text-sm text-danger">{error}</p>}
        {!pending && !dirty && allSaved && <p className="text-sm text-success">Saved.</p>}
      </div>
    </div>
  );
}
