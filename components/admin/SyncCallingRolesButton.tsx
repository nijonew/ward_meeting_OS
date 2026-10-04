"use client";

import { useState, useTransition } from "react";
import { syncAllCallingRoles } from "@/app/admin/verify-logins/actions";

/**
 * "Sync roles now" (2026-10-04, migration 057's own manual catch-up) --
 * needed for after a brand-new calling_role_mappings row is added:
 * adding that row alone doesn't retroactively touch anyone already
 * holding that calling, since nothing fires a trigger on
 * calling_role_mappings itself. Going forward, a calling's holder
 * changing fires the real Postgres trigger automatically -- this
 * button is only for catching up an existing mapping gap, not
 * something that needs clicking routinely.
 */
export function SyncCallingRolesButton() {
  const [pending, startSync] = useTransition();
  const [result, setResult] = useState<"success" | "error" | null>(null);

  const run = () => {
    setResult(null);
    startSync(async () => {
      const outcome = await syncAllCallingRoles();
      setResult("error" in outcome ? "error" : "success");
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded border border-rule px-3 py-1.5 text-xs text-ink hover:bg-ink/5 disabled:opacity-50"
      >
        {pending ? "Syncing..." : "Sync roles now"}
      </button>
      {result === "success" && <span className="text-xs text-ink-muted">Done.</span>}
      {result === "error" && <span className="text-xs text-danger">Something went wrong.</span>}
    </div>
  );
}
