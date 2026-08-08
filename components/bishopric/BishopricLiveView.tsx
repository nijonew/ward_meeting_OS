import type { BishopricMeetingData } from "@/lib/data/bishopric-meeting";

export function BishopricLiveView({ data }: { data: BishopricMeetingData }) {
  const field = (label: string, value: string | null | undefined) =>
    value ? (
      <div className="mt-4">
        <p className="font-mono text-[11px] uppercase tracking-widest text-slate/70">{label}</p>
        <p className="mt-1 text-lg text-ink">{value}</p>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-rule bg-card p-6">
        {field("Spiritual Thought", data.minutes?.spiritual_thought_notes)}
        {field("Handbook Training", data.minutes?.handbook_training_topic)}
        {field("Calendar Review", data.minutes?.calendar_review_notes)}
        {field("Callings Discussion", data.minutes?.callings_discussion_notes)}
        {field("Sacrament Planning Discussion", data.minutes?.sacrament_planning_discussion_notes)}
        {field("Young Men Coordination", data.minutes?.young_men_coordination_notes)}
        {field("Impressions", data.minutes?.impressions)}
        {field("Minutes", data.minutes?.minutes_body)}
        {field("Next Meeting", data.minutes?.next_meeting_date)}
      </div>

      {data.actionItems.length > 0 && (
        <div className="rounded-lg border border-rule bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-widest text-slate/70">Action Items</p>
          <ul className="mt-2 flex flex-col gap-1">
            {data.actionItems.map((item) => (
              <li key={item.id} className={item.completed ? "text-slate/50 line-through" : "text-lg text-ink"}>
                {item.description}
                {item.assigned_to_name && <span className="text-slate"> &mdash; {item.assigned_to_name}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.agendaItems.filter((i) => i.status === "published").length > 0 && (
        <div className="rounded-lg border border-rule bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-widest text-slate/70">Agenda Items</p>
          <ul className="mt-2 flex flex-col gap-1">
            {data.agendaItems
              .filter((i) => i.status === "published")
              .map((item) => (
                <li key={item.id} className="text-lg text-ink">
                  {item.title}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}