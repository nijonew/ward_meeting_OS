import { MEETING_LIFECYCLE_STAGES, type MeetingLifecycleStage } from "@/lib/types";

const STAGE_LABELS: Record<MeetingLifecycleStage, string> = {
  template: "Template",
  planning: "Planning",
  review: "Review",
  ready: "Ready",
  live: "Live",
  archived: "Archived",
};

/**
 * Renders the meeting lifecycle (architecture.md section 4) as a stamped
 * status track, with the current stage highlighted. Intentionally reused
 * as-is on the dashboard and meeting detail views rather than re-derived,
 * per the project's own "views instead of duplicate data" principle.
 *
 * `compact` (2026-09-09, the user's own request: "the status fields can
 * be eliminated except for the status that is current") renders just
 * the current stage's own pill, no track/connectors -- used by
 * /dashboard's single-line grid rows, which needed the horizontal room
 * back for the date button instead. The full track stays the default
 * everywhere else (e.g. a meeting's own header), where showing the
 * whole lifecycle at a glance is still the point.
 *
 * `stages` (2026-09-10, the user's own request: "we can remove the
 * review, ready, live statuses for sacrament meeting") lets a caller
 * show a shorter track than the full 6-stage one -- Sacrament Meeting's
 * own header passes `["template", "planning", "archived"]`, since
 * nothing in this app has ever had a way to move a meeting into
 * review/ready/live (no Table Admin column, no dedicated action --
 * `meetings.stage` is deliberately excluded from Table Admin precisely
 * because "the lifecycle... controls what the public program page
 * shows -- edit it through the meeting's own pages, not here", and no
 * such page-level control for those three stages was ever built).
 * Defaults to the full list for every other meeting type, unchanged.
 *
 * Restyled per design.md's Components section (sitewide redesign pass):
 * a bordered chip, not a filled pill, for every stage except the
 * current one -- accent fill is reserved for "this is happening now,"
 * not decoration repeated down the whole track. 4px radius (`rounded`),
 * matching every other chip/card in the app rather than this
 * component's own one-off `rounded-full`.
 */
export function LifecycleBadge({
  stage,
  compact,
  stages = MEETING_LIFECYCLE_STAGES,
}: {
  stage: MeetingLifecycleStage;
  compact?: boolean;
  stages?: MeetingLifecycleStage[];
}) {
  if (compact) {
    return (
      <span
        role="img"
        aria-label={`Meeting stage: ${STAGE_LABELS[stage]}`}
        className="flex h-7 w-max items-center whitespace-nowrap rounded border border-accent bg-accent px-3 font-mono text-[11px] uppercase tracking-wider text-surface"
      >
        {STAGE_LABELS[stage]}
      </span>
    );
  }

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
