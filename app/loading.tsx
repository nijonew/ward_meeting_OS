/**
 * Root-level loading UI (2026-10-12, the user's own report: "slow on
 * every click... I don't have a response of any kind indicating a
 * click was received"). This app has never had a navigation loading
 * indicator anywhere -- Next.js shows nothing of its own between a
 * click and the next page appearing, so with prefetching now also
 * turned off on the highest-traffic links (see Tile.tsx's own
 * comment), every click incurs a real, visible round trip with no
 * feedback that it even registered -- exactly what was driving the
 * repeat-clicking seen in the Network tab (duplicate fetches for the
 * same navigation). A `loading.tsx` at the app root is picked up by
 * every route automatically (Next.js wraps the routed page content in
 * a Suspense boundary using this as the fallback) -- no per-page
 * wiring needed.
 */
export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-12 sm:px-8">
      <p className="animate-pulse font-mono text-xs uppercase tracking-wider text-ink-muted">Loading&hellip;</p>
    </main>
  );
}
