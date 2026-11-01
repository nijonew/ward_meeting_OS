"use client";

import { useTransition } from "react";
import { DragReorderGroup } from "@/components/drag-reorder/DragReorderGroup";
import { DragHandle } from "@/components/drag-reorder/DragHandle";
import { useSortableRow } from "@/lib/hooks/use-sortable-row";
import { useReorderAction } from "@/lib/hooks/use-reorder-action";
import { setRotationMemberOrder, removeRotationMember } from "@/app/rotations/actions";
import type { RotationMember } from "@/lib/data/rotations";

/**
 * Rotation Order's own member list -- a drag handle instead of
 * Move Up/Down buttons (2026-10-31, the user's own request: "apply
 * broadly everywhere!"). Needs to be a Client Component (drag
 * interaction can't run in a Server Component) -- `RotationCard`
 * itself (app/rotations/page.tsx) stays a Server Component and just
 * renders this for its own member list; Remove is still a plain server
 * action call, no longer an inline per-row "use server" closure since
 * there's no reason left for one.
 */
export function RotationMemberList({
  rotationId,
  members,
  nextIndex,
}: {
  rotationId: string;
  members: RotationMember[];
  nextIndex: number;
}) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const { onReorder, error } = useReorderAction((orderedIds) => setRotationMemberOrder(rotationId, orderedIds));

  return (
    <>
      <DragReorderGroup ids={members.map((m) => m.id)} onReorder={onReorder}>
        {(orderedIds) => (
          <ul className="mt-2 flex flex-col gap-1.5">
            {orderedIds.map((id, idx) => {
              const member = byId.get(id);
              if (!member) return null;
              return <MemberRow key={id} member={member} isNext={idx === nextIndex % Math.max(members.length, 1)} />;
            })}
          </ul>
        )}
      </DragReorderGroup>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </>
  );
}

function MemberRow({ member, isNext }: { member: RotationMember; isNext: boolean }) {
  const { rowProps, handleProps } = useSortableRow(member.id);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    startTransition(() => {
      void removeRotationMember(member.id);
    });
  };

  return (
    <li {...rowProps} className="flex items-center justify-between gap-2 rounded border border-rule/60 px-3 py-1.5 text-sm">
      <span className="flex items-center gap-2">
        <DragHandle {...handleProps} />
        <span className={isNext ? "text-ink" : "text-ink-muted"}>{member.display_label}</span>
      </span>
      <button
        type="button"
        onClick={remove}
        disabled={pending}
        className="text-xs text-danger/70 hover:text-danger disabled:opacity-50"
      >
        {pending ? "Removing..." : "Remove"}
      </button>
    </li>
  );
}
