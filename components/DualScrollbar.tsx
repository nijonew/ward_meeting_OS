"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Wraps a wide table's own `overflow-x-auto` scroll container and adds
 * a second, synced horizontal scrollbar that sticks to the bottom of
 * the viewport while any part of the table is still on screen
 * (2026-10-25, the user's own request: "Is there a way to keep the
 * bottom scroll bar always on the screen... on table pages like the
 * announcements and calling planning?").
 *
 * The real problem this solves: a browser's native horizontal
 * scrollbar sits at the very bottom edge of its own scrolling
 * element's box, in normal document flow -- for a tall table (many
 * rows), that's far below the visible viewport, so reaching it means
 * scrolling the whole page down past the table first. A genuinely
 * "sticky" native scrollbar isn't something CSS can do (there's no way
 * to reposition a native scrollbar independently of its element), so
 * this adds a second, thin scroll strip that *is* a real
 * `position: sticky; bottom: 0` element -- it stays pinned to the
 * bottom of the viewport for as long as the table (its own, taller
 * sibling) is still partially in view, then scrolls away normally once
 * the table itself has fully scrolled past. Dragging it scrolls the
 * real table horizontally and vice versa (two-way synced via a plain
 * scroll-event listener on each side, guarded against an infinite
 * ping-pong with a `syncing` ref).
 *
 * Deliberately NOT replacing the table's own native scrollbar --
 * both exist side by side (the real one still works fine for a mouse
 * wheel/trackpad swipe directly over the table) -- this is purely an
 * additive second control surface, reusable for every "favorite grid
 * format" page and Table Admin's own generic grid, since none of them
 * have any per-table logic to special-case here.
 *
 * Only rendered once there's actually something to scroll -- a table
 * that already fits within its own container shows nothing extra.
 * Re-checks on every resize (a column widening, a filter hiding rows,
 * the window itself resizing) via `ResizeObserver` on the real
 * scrollable content, not just once on mount.
 *
 * **Hides itself once the real native scrollbar is already visible,
 * 2026-10-25** (the user's own follow-up: "can we have the second
 * scroll bar automatically disappear when the native scrollbar
 * appears? otherwise we see two scrollbars"). The clone's whole
 * reason to exist is reaching a scrollbar that's currently off-screen
 * -- once you've scrolled far enough down that the table's own bottom
 * edge (where its native scrollbar lives) is back in view, showing
 * both is exactly the redundant double-scrollbar the user flagged. A
 * zero-height sentinel sits right at the bottom of the real scrollable
 * content; an `IntersectionObserver` watching it toggles the clone
 * off the instant that point enters the viewport, and back on once it
 * scrolls back out (in either direction -- scrolling further down
 * past a short table, or back up away from a tall one's own bottom).
 */
export function DualScrollbar({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cloneRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [nativeVisible, setNativeVisible] = useState(false);

  useEffect(() => {
    const scroller = scrollRef.current;
    const clone = cloneRef.current;
    const spacer = spacerRef.current;
    const sentinel = sentinelRef.current;
    if (!scroller || !clone || !spacer || !sentinel) return;

    const syncSize = () => {
      spacer.style.width = `${scroller.scrollWidth}px`;
      setHasOverflow(scroller.scrollWidth > scroller.clientWidth + 1);
    };

    const onScrollerScroll = () => {
      if (syncing.current) return;
      syncing.current = true;
      clone.scrollLeft = scroller.scrollLeft;
      syncing.current = false;
    };
    const onCloneScroll = () => {
      if (syncing.current) return;
      syncing.current = true;
      scroller.scrollLeft = clone.scrollLeft;
      syncing.current = false;
    };

    syncSize();
    scroller.addEventListener("scroll", onScrollerScroll);
    clone.addEventListener("scroll", onCloneScroll);

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(scroller);
    // The direct child (the real table) is what actually changes
    // width when a column grows or a save re-renders wider content --
    // observing it too catches that even when the scroller's own
    // outer box stays the same size.
    if (scroller.firstElementChild) resizeObserver.observe(scroller.firstElementChild);

    const intersectionObserver = new IntersectionObserver(([entry]) => setNativeVisible(entry.isIntersecting));
    intersectionObserver.observe(sentinel);

    return () => {
      scroller.removeEventListener("scroll", onScrollerScroll);
      clone.removeEventListener("scroll", onCloneScroll);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, []);

  const showClone = hasOverflow && !nativeVisible;

  return (
    <div className="relative">
      <div ref={scrollRef} className="overflow-x-auto">
        {children}
        <div ref={sentinelRef} aria-hidden="true" />
      </div>
      <div
        ref={cloneRef}
        aria-hidden="true"
        className={`sticky bottom-0 z-20 overflow-x-auto overflow-y-hidden bg-surface ${showClone ? "h-3" : "h-0"}`}
      >
        <div ref={spacerRef} className="h-px" />
      </div>
    </div>
  );
}
