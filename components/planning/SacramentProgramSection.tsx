"use client";

import { useTransition } from "react";
import {
  addProgramItem,
  removeProgramItem,
  moveProgramItem,
  saveProgramSpeaker,
  saveProgramMusic,
} from "@/app/meetings/[id]/speakers-music-actions";
import { allProgramItemOptions, type ResolvedProgramItem } from "@/lib/data/sacrament-program-shared";
import { SpeakerPersonOrGuestField } from "@/components/planning/SpeakerPersonOrGuestField";
import type { PersonOption } from "@/lib/data/people";

const INPUT = "rounded-md border border-rule bg-paper px-3 py-2 text-sm text-ink";

function ItemRow({ item, meetingId, people }: { item: ResolvedProgramItem; meetingId: string; people: PersonOption[] }) {
  const [removing, startRemove] = useTransition();
  const [moving, startMove] = useTransition();

  const remove = () => {
    if (!window.confirm(`Remove ${item.label}?`)) return;
    startRemove(async () => {
      await removeProgramItem(item.id, meetingId);
    });
  };
  const move = (direction: "up" | "down") => startMove(async () => {
    await moveProgramItem(meetingId, item.id, direction);
  });

  const saveSpeaker = async (formData: FormData) => {
    const table = item.kind === "youth_speaker" ? "sacrament_speakers_youth" : "sacrament_speakers_adults";
    await saveProgramSpeaker(meetingId, table, item.itemKey, formData);
  };
  const saveMusic = async (formData: FormData) => {
    await saveProgramMusic(meetingId, item.kind as "musical_number" | "intermediate_hymn", item.itemKey, formData);
  };

  return (
    <li className="rounded-md border border-rule/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-widest text-slate/70">{item.label}</span>
        <span className="flex items-center gap-3">
          <button type="button" onClick={() => move("up")} disabled={moving} className="text-xs text-slate hover:text-ink disabled:opacity-30">
            &uarr;
          </button>
          <button type="button" onClick={() => move("down")} disabled={moving} className="text-xs text-slate hover:text-ink disabled:opacity-30">
            &darr;
          </button>
          <button type="button" onClick={remove} disabled={removing} className="text-xs text-slate hover:text-ink disabled:opacity-30">
            Remove
          </button>
        </span>
      </div>

      {(item.kind === "speaker" || item.kind === "youth_speaker") && (
        <form action={saveSpeaker} className="mt-2 flex flex-wrap items-center gap-2">
          <SpeakerPersonOrGuestField people={people} defaultPersonId={item.personId} defaultGuestName={item.guestName} />
          <button type="submit" className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-ink/90">
            Save
          </button>
        </form>
      )}

      {item.kind === "musical_number" && (
        <form action={saveMusic} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="text" name="piece_name" defaultValue={item.title} placeholder="Title" className={INPUT} />
          <input type="text" name="performer" defaultValue={item.performer} placeholder="Individual or group name" className={INPUT} />
          <select name="accompanist_id" defaultValue={item.accompanistId} className={INPUT}>
            <option value="">&mdash; Accompanist &mdash;</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-ink/90">
            Save
          </button>
        </form>
      )}

      {item.kind === "intermediate_hymn" && (
        <form action={saveMusic} className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            name="hymn_number"
            defaultValue={item.hymnNumber}
            placeholder="#"
            className={`${INPUT} w-16`}
          />
          <input type="text" name="piece_name" defaultValue={item.title} placeholder="Hymn title" className={INPUT} />
          <button type="submit" className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-ink/90">
            Save
          </button>
        </form>
      )}

      {item.kind === "testimony" && <p className="mt-2 text-sm text-slate">Open testimony &mdash; nothing to fill in.</p>}
    </li>
  );
}

/**
 * The Speakers & Music portion of Sacrament Meeting -- built 2026-09-09
 * as its own freely add/remove/reorderable list ("the speakers and
 * music portion of the meeting should have a dynamic number of
 * elements where elements can be added or removed"), then moved
 * inline into the main planning page 2026-09-10 per the user's
 * follow-up ("I would like to move the speaker/music management items
 * directly into the agenda rather than by link"). Rendered directly in
 * the flow of the agenda, between the two `AgendaGridForm` halves
 * (app/meetings/[id]/planning/page.tsx splits the agenda in two right
 * where this belongs) -- each item's own add/remove/save controls are
 * real `<form>`s, siblings of (not descendants of) the surrounding
 * grid forms, so nothing here hits HTML's "no nested forms" rule the
 * way embedding this *inside* one of those grids' own `<form>` would.
 * Ward Business/RABNM still lives on its own separate page -- only
 * Speakers & Music moved back inline, per this specific request. The
 * "Teaching Program" section heading itself is rendered by the page,
 * immediately above this component -- one of the meeting's four named
 * sections (Opening, Administration of the Sacrament, Teaching
 * Program, Closing; 2026-09-10, also the user's own request), not
 * something specific to this component.
 */
export function SacramentProgramSection({
  meetingId,
  items,
  people,
}: {
  meetingId: string;
  items: ResolvedProgramItem[];
  people: PersonOption[];
}) {
  const [adding, startAdd] = useTransition();
  const usedKeys = new Set(items.map((i) => i.itemKey.startsWith("intermediate_hymn") ? "intermediate_hymn" : i.itemKey));
  // Intermediate Hymn's own dropdown option stays available even after
  // one's been added (it can repeat, auto-numbered) -- everything else
  // (numbered slots, and the one-shot Testimony) drops out once used.
  const available = allProgramItemOptions().filter((o) => o.key === "intermediate_hymn" || !usedKeys.has(o.key));

  const add = (formData: FormData) => {
    const itemKey = String(formData.get("item_key") ?? "");
    if (!itemKey) return;
    startAdd(async () => {
      await addProgramItem(meetingId, itemKey);
    });
  };

  return (
    <div className="mt-2">
      <p className="text-xs text-slate">
        Pre-filled from this meeting&rsquo;s format -- add or remove speakers, musical numbers, and
        testimonies here, in whatever order.
      </p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate">Nothing added yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {items.map((item) => (
            <ItemRow key={item.id} item={item} meetingId={meetingId} people={people} />
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <form action={add} className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule/60 pt-4">
          <select name="item_key" defaultValue="" className={INPUT} disabled={adding}>
            <option value="" disabled>
              Choose what to add&hellip;
            </option>
            {available.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={adding}
            className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink/90 disabled:opacity-50"
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </form>
      )}
    </div>
  );
}
