"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signInWithPassword(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}

/** Backs /auth/reset-password -- "I already have an account and
 *  forgot my password." Used to also back /auth/new-user ("signing in
 *  for the first time," for an admin-invited account), split into two
 *  pages with different copy 2026-10-03, but that page is deleted as
 *  of 2026-10-10 -- see /auth/request-access's own comment for why --
 *  so this action now has exactly one caller. */
export async function requestPasswordReset(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Enter an email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/update-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

/**
 * Self-serve "Request Access" (2026-10-03, the user's own question:
 * "Can the user create an account without the ward admin setting that
 * up first?"). As of 2026-10-10, this is the one and only way anyone
 * without access gets an account -- the admin-invites-via-dashboard
 * alternative (and its matching "/auth/new-user" page) is gone, per
 * the user's own request to collapse this down to a single path.
 * Creates a real `auth.users` row via Supabase's own sign-up.
 *
 * No separate "pending request" table or approval queue needed: the
 * resulting `profiles` row comes in with `role = null` (confirmed
 * directly by the user), which is exactly the signal
 * lib/data/profile-verification.ts already treats as "needs
 * verification" -- a self-signed-up account shows up in the exact
 * same admin queue/banner an admin-invited-but-unverified one does.
 * Nothing new to build on the review side at all.
 */
export async function requestAccess(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!email) {
    return { error: "Enter your email address." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function updatePassword(_prevState: unknown, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirm) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}