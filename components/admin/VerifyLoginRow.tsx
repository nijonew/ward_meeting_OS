"use client";

import { useState, useTransition } from "react";
import { verifyLogin } from "@/app/admin/verify-logins/actions";
import { GRANTABLE_ROLES, type UnverifiedProfile } from "@/lib/data/profile-verification-shared";
import type { PersonOption } from "@/lib/data/people";
import type { StoredRole } from "@/lib/supabase/get-session-user";

const SELECT = "w-full rounded border border-rule bg-paper px-2 py-1.5 text-xs text-ink";

/**
 * One unverified login -- pick an existing person (or type a new
 * one's name) and a role, then commit both in one "Verify" click via
 * verifyLogin. The "bishop" role option is left out of the dropdown
 * entirely for anyone who isn't already a sitting Bishop
 * (canGrantBishop) -- the server action re-checks this too, so hiding
 * it here is a UX nicety, not the actual enforcement boundary.
 */
export function VerifyLoginRow({
  profile,
  people,
  canGrantBishop,
}: {
  profile: UnverifiedProfile;
  people: PersonOption[];
  canGrantBishop: boolean;
}) {
  const [personId, setPersonId] = useState("");
  const [newName, setNewName] = useState("");
  const [role, setRole] = useState<StoredRole | "">("");
  const [pending, startVerify] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const roles = GRANTABLE_ROLES.filter((r) => r.value !== "bishop" || canGrantBishop);

  const submit = () => {
    if (!role) return;
    setError(null);
    startVerify(async () => {
      const result = await verifyLogin(profile.id, role, personId || null, personId ? "" : newName);
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
        <td colSpan={4} className="py-3 text-sm text-ink-muted">
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
      <td className="py-3 pr-3">
        <select value={role} onChange={(e) => setRole(e.target.value as StoredRole)} className={SELECT}>
          <option value="">Choose role</option>
          {roles.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </td>
      <td className="py-3">
        <button
          type="button"
          onClick={submit}
          disabled={!role || pending}
          className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-50"
        >
          {pending ? "Verifying..." : "Verify"}
        </button>
        {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      </td>
    </tr>
  );
}
