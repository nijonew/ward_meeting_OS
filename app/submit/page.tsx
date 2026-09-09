import { redirect } from "next/navigation";

/**
 * /submit itself no longer renders a form -- announcement submission
 * moved to /submit/announcement (gated, 2026-09-09) alongside
 * /submit/agenda-item. Redirects rather than 404ing so an old
 * bookmark or link still lands somewhere useful; the destination
 * page's own login/attendance check takes it from there.
 */
export default function SubmitPage() {
  redirect("/submit/announcement");
}
