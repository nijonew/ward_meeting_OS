"use client";

import { useState, useTransition } from "react";
import { restorePerson, deletePersonPermanently } from "@/app/admin/archived-people/actions";
import type { ArchivedPerson } from "@/lib/data/archived-people";

export function ArchivedPersonRow({ person }: { person: ArchivedPerson }) {
  const [restoring, startRestore] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const restore = () => {
    setError(null);
    startRestore(async () => {
      const result = await restorePerson(person.id);
      if ("error" in result) setError(result.error);
    });
  };

  const deleteForever = () => {
    if (!window.confirm(`Permanently delete ${person.name}? This cannot be undone.`)) return;
    setError(null);
    startDelete(async () => {
      const result = await deletePersonPermanently(person.id);
      if ("error" in result) setError(result.error);
    });
  };

  return (
    <tr className="border-b border-rule/40 align-top last:border-0">
      <td className="py-2 pr-3 text-ink">{person.name}</td>
      <td className="py-2 pr-3 text-ink-muted">{new Date(person.archived_at).toLocaleDateString()}</td>
      <td className="py-2 text-right">
        <span className="inline-flex items-center gap-3">
          <button type="button" onClick={restore} disabled={restoring || deleting} className="text-xs text-ink hover:text-accent">
            {restoring ? "Restoring..." : "Restore"}
          </button>
          <button
            type="button"
            onClick={deleteForever}
            disabled={restoring || deleting}
            className="text-xs text-danger/70 hover:text-danger"
          >
            {deleting ? "Deleting..." : "Delete Permanently"}
          </button>
        </span>
        {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
      </td>
    </tr>
  );
}
