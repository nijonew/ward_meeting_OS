"use client";

import { useEffect, useState } from "react";
import { refreshConductingScript } from "@/app/meetings/[id]/conducting-actions";
import { ConductingRowList } from "@/components/planning/ConductingRowList";
import type { ConductingRow } from "@/lib/data/conducting-rows";

/** 8 seconds -- frequent enough to feel live during a meeting,
 *  infrequent enough that the load is trivial. See the conducting
 *  redesign plan's own note on why this is a poll rather than a
 *  Supabase Realtime subscription: this app has never used Realtime or
 *  a client-side Supabase client anywhere, and wiring it up would mean
 *  enabling it on ~8 tables and verifying RLS/Realtime interaction live
 *  against the real project -- a poll gets "no manual refresh needed"
 *  with far less new surface area. */
const POLL_INTERVAL_MS = 8000;

/**
 * Owns the "updates in real time as the planning view updates"
 * requirement (2026-09-10, the user's own words) for an otherwise
 * fully read-only view -- nothing here is editable, so a plain
 * client-side poll-and-replace is enough; there's no local edit state
 * that a refresh could ever clobber.
 */
export function ConductingScriptView({
  meetingId,
  initialRows,
}: {
  meetingId: string;
  initialRows: ConductingRow[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const fresh = await refreshConductingScript(meetingId);
      if (fresh) {
        setRows(fresh);
        setUpdatedAt(new Date().toLocaleTimeString());
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [meetingId]);

  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate/50">
        Live{updatedAt ? ` — updated ${updatedAt}` : ""}
      </p>
      <ConductingRowList rows={rows} />
    </div>
  );
}
