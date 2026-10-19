import { MEETING_LIFECYCLE_STAGES, type MeetingLifecycleStage } from "@/lib/types";

const STAGE_LABELS: Record<MeetingLifecycleStage, string> = {
  template: "Template",
  planning: "Planning",
  archived: "Archived",
};

/**
 * Renders the meeting lifecycle (lib/types.ts) as a stamped status
 * track, with the current stage highlighted. Intentionally reused
 * as-is on the dashboard rather than re-derived, per the project's own
 * "views instead of duplicate data" principle.
 *
 * `compact` (2026-09-09) renders just the current stage's own pill, no
 * track/connectors -- used by /dashboard's single-line grid rows,
 * which needed the horizontal room back for the date button instead.
 *
 * **Dropped the `stages` override and the dead Review/Ready/Live
 * labels entirely, 2026-10-19** -- the full lifecycle used to list 6
 * stages, 3 of which (review/ready/live) were never actually
 * reachable by any code path for any meeting type (confirmed by
 * grepping every `stage:` write site -- see lib/types.ts's own
 * comment). Sacrament Meeting's own header already passed a shortened
 * `["template", "planning", "archived"]` override to work around this;
 * now that `MeetingLifecycleStage` itself only has those 3 values,
 * every caller already shows the same short track with no override
 * needed. This component is no longer rendered on individual meeting
 * pages at all (removed from app/meetings/[id]/layout.tsx the same
 * day, per the user's own request to eliminate the stage/phase
 * concept from those pages entirely) -- only the dashboard's compact
 * per-row badge still uses it, which is unaffected by that removal.
 */
export function LifecycleBadge({
  stage,
  compact,
}: {
  stage: MeetingLifecycleStage;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span
        role="img"
        aria-label={`Meeting stage: ${STAGE_LABELS[stage]}`}
        className="flex h-7 w-max items-center whitespace-nowrap rounded border border-rule bg-surface px-3 font-mono text-[11px] uppercase tracking-wider text-ink-muted"
      >
        {STAGE_LABELS[stage]}
      </span>
    );
  }

  const stages = MEETING_LIFECYCLE_STAGES;
  const currentIndex = stages.indexOf(stage);

  return (
    <div
      className="flex w-max items-center"
      role="img"
      aria-label={`Meeting stage: ${STAGE_LABELS[stage]}`}
    >
      {stages.map((s, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;

        return (
          <div key={s} className="flex items-center">
            <span
              className={[
                "flex h-7 items-center whitespace-nowrap rounded border px-3 font-mono text-[11px] uppercase tracking-wider transition-colors",
                isCurrent
                  ? "border-accent bg-accent text-surface"
                  : isPast
                    ? "border-rule text-ink-muted"
                    : "border-rule/50 text-ink-muted/50",
              ].join(" ")}
            >
              {STAGE_LABELS[s]}
            </span>
            {i < stages.length - 1 && (
              <span
                className={["h-px w-4 shrink-0", isPast ? "bg-rule-strong" : "bg-rule"].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
