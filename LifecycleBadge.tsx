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
 */
export function LifecycleBadge({ stage }: { stage: MeetingLifecycleStage }) {
  const currentIndex = MEETING_LIFECYCLE_STAGES.indexOf(stage);

  return (
    <div
      className="flex w-max items-center"
      role="img"
      aria-label={`Meeting stage: ${STAGE_LABELS[stage]}`}
    >
      {MEETING_LIFECYCLE_STAGES.map((s, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;

        return (
          <div key={s} className="flex items-center">
            <span
              className={[
                "flex h-7 items-center whitespace-nowrap rounded-full px-3 font-mono text-[11px] uppercase tracking-wider transition-colors",
                isCurrent
                  ? "bg-brass text-paper"
                  : isPast
                    ? "bg-ink/10 text-ink/50"
                    : "bg-transparent text-ink/30",
              ].join(" ")}
            >
              {STAGE_LABELS[s]}
            </span>
            {i < MEETING_LIFECYCLE_STAGES.length - 1 && (
              <span
                className={["h-px w-4 shrink-0", isPast ? "bg-ink/20" : "bg-ink/10"].join(" ")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
