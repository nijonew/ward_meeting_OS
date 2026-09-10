import { redirect } from "next/navigation";

/**
 * /teaching-calendar itself no longer renders a page -- renamed to
 * Youth Teaching Planning and reworked into a per-class hub
 * (2026-09-09, the user's own request). Redirects rather than 404ing
 * so an old bookmark or link still lands somewhere real.
 */
export default function TeachingCalendarPage() {
  redirect("/youth-teaching-planning");
}
