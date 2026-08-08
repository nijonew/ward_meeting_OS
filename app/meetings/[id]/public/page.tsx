import { getPublicSacramentView } from "@/lib/data/public-view";

export default async function PublicViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: meetingId } = await params;
  const view = await getPublicSacramentView(meetingId);

  if (!view) {
    return <p className="text-slate">Could not load this meeting.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {view.items.map((item, i) => (
        <div
          key={i}
          className="flex items-baseline justify-between gap-4 border-b border-rule/40 py-2 last:border-0"
        >
          <span className="text-ink">{item.heading}</span>
          {item.detail && <span className="text-right text-slate">{item.detail}</span>}
        </div>
      ))}
    </div>
  );
}