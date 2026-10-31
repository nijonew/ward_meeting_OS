-- 092_signup_display_name.sql
--
-- Lets self-serve sign-up (requestAccess, app/auth/actions.ts) record a
-- first name right at account creation -- the user's own idea: "I am
-- considering asking individuals to include a first name when they
-- create a new log-in to help ensure we can identify them when we
-- verify their request," confirmed to build.
--
-- `profiles.display_name` has always existed but had no producer
-- anywhere in this app (see PROJECT_CONTEXT.md's 2026-10-11 "submitted
-- by showed an email" entry) -- Verify Logins already renders it
-- (components/admin/VerifyLoginRow.tsx), it's just always been blank.
--
-- requestAccess runs through the ordinary anon-key client, with no
-- active session yet (email confirmation happens after this call, not
-- before) -- a plain `update profiles set display_name = ...` from
-- that context would need an RLS policy this app doesn't have and
-- shouldn't add just for this. A SECURITY DEFINER function is the
-- same established pattern already used elsewhere in this app for
-- exactly this "the normal client can't do this, but the action is
-- legitimate" situation (archive_person, get_public_people_names).
--
-- Deliberately narrow, not a general-purpose "set anyone's display
-- name" RPC: only succeeds for a profile that's still unlinked (no
-- `people` row points at it yet -- the same "needs verification"
-- definition lib/data/profile-verification.ts already uses) AND whose
-- display_name is still null -- i.e. only the one moment right after
-- a brand-new sign-up, before any admin has reviewed the account.
-- Calling this again later (or for someone else's id) is a no-op, not
-- an error -- a signed-up account vandalizing its own already-set name,
-- or anyone else's, isn't possible through this function.

drop function if exists set_signup_display_name(uuid, text);
create function set_signup_display_name(target_id uuid, new_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
  set display_name = new_name
  where id = target_id
    and display_name is null
    and not exists (select 1 from people where profile_id = target_id);
end;
$$;
