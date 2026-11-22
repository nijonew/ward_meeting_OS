"use client";

import { setReviewAnnouncementOrder } from "@/app/meetings/[id]/bishopric-actions";
import { DragReorderGroup } from "@/components/drag-reorder/DragReorderGroup";
import { DragHandle } from "@/components/drag-reorder/DragHandle";
import { useSortableRow } from "@/lib/hooks/use-sortable-row";
import { useReorderAction } from "@/lib/hooks/use-reorder-action";
import type { ReviewAnnouncement } from "@/lib/data/meeting-review";

function ReviewAnnouncementRow({ item }: { item: ReviewAnnouncement }) {
  const { rowProps, handleProps } = useSortableRow(item.id);
  return (
    <li {...rowProps} className="flex items-center gap-2 text-sm text-ink">
      <DragHandle {...handleProps} />
      {item.title}
    </li>
  );
}

/**
 * Drag handle for the Review section's own announcements list
 * (2026-11-22, the user's own request, same day as Agenda Items'
 * identical ask: "Same with announcements"). Membership here is still
 * purely automatic (whatever matches this meeting type's own
 * `where_announced` label, see `getAnnouncementsForMeetingReview`'s own
 * doc comment) -- this only lets an admin set the DISPLAY order those
 * matched announcements read in, same `collaborative_announcement_order`
 * table (migration 110) every item here already has a row in by the
 * time this renders.
 *
 * A separate file (not inlined in `AgendaGridForm.tsx`), same reason as
 * `WardBusinessField`/`AnnouncementsField` right above it there -- kept
 * out of the shared chunk via `next/dynamic`, since it pulls in
 * `@dnd-kit` like they do.
 */
export function ReviewAnnouncementsField({ meetingId, items }: { meetingId: string; items: ReviewAnnouncement[] }) {
  const { onReorder, error } = useReorderAction((orderedIds) => setReviewAnnouncementOrder(meetingId, orderedIds));

  if (items.length === 0) {
    return <p className="text-sm text-ink-muted/50">None</p>;
  }

  return (
    <div>
      <DragReorderGroup ids={items.map((item) => item.id)} onReorder={onReorder}>
        {(orderedIds) => {
          const byId = new Map(items.map((item) => [item.id, item]));
          return (
            <ul className="flex flex-col gap-2">
              {orderedIds.map((id) => {
                const item = byId.get(id);
                return item ? <ReviewAnnouncementRow key={id} item={item} /> : null;
              })}
            </ul>
          );
        }}
      </DragReorderGroup>
      {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
    </div>
  );
}
