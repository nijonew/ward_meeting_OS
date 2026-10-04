"use client";

import { useState, useTransition } from "react";
import { verifyLogin } from "@/app/admin/verify-logins/actions";
import type { UnverifiedProfile } from "@/lib/data/profile-verification-shared";
import type { PersonOption } from "@/lib/data/people";

const SELECT = "w-full rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink";

/**
 * One unverified login -- pick an existing person (or type a new
 * one's name), then Verify. No role to choose anymore (2026-10-04,
 * roles eliminated) -- linking is all this does; access then comes
 * automatically from whichever calling(s) that person holds.
 */
export function VerifyLoginRow({ profile, people }: { profile: UnverifiedProfile; people: PersonOption[] }) {
  const [personId, setPersonId] = useState("");
  const [newName, setNewName] = useState("");
  const [pending, startVerify] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = () => {
    if (!personId && !newName.trim()) return;
    setError(null);
    startVerify(async () => {
      const result = await verifyLogin(profile.id, personId || null, personId ? "" : newName);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDone(true);
    });
  };

  if (done) {
    return (
      <tr className="border-t border-rule/40">
        <td colSpan={3} className="py-3 text-sm text-ink-muted">
          Verified -- {profile.display_name || profile.email}.
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-rule/40 align-top">
      <td className="py-3 pr-3">
        <div className="text-sm text-ink">{profile.display_name || "(no name)"}</div>
        <div className="text-xs text-ink-muted">{profile.email}</div>
      </td>
      <td className="py-3 pr-3">
        <select value={personId} onChange={(e) => setPersonId(e.target.value)} className={SELECT}>
          <option value="">+ New person&hellip;</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {!personId && (
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New person's name"
            className={`mt-1 ${SELECT}`}
          />
        )}
      </td>
      <td className="py-3">
        <button
          type="button"
          onClick={submit}
          disabled={(!personId && !newName.trim()) || pending}
          className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          {pending ? "Verifying..." : "Verify"}
        </button>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </td>
    </tr>
  );
}
