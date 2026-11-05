"use client";

import { useState } from "react";

/**
 * A real, obviously-clickable button for an optional image upload --
 * shared between the public Submit Announcement form
 * (`components/submit/AnnouncementForm.tsx`) and the Feedback Widget's
 * own screenshot field (`components/FeedbackWidget.tsx`), 2026-11-04
 * (the user's own report: "it is not easy to determine that it is a
 * button... might be the same thing where we have the ability to add
 * an image to the suggestions" -- both fields had the identical plain,
 * unstyled `<input type="file">`, which renders as whatever the
 * browser's own OS-styled file-picker control looks like, not
 * something that reads as a button in this app's own visual language).
 *
 * A native file input's own "Choose File" button can't be restyled
 * directly (every browser ignores most CSS on it) -- the standard,
 * accessible fix is to visually hide the real input (`sr-only`, not
 * `hidden`/`display:none`, so it stays reachable by Tab and a screen
 * reader) and trigger it through an ordinary `<label>` instead, styled
 * like every other secondary button in this app. Clicking -- or
 * activating via keyboard -- the label opens the real file picker;
 * no JS needed for that part. The chosen filename (or "No file
 * chosen") renders next to the button, since hiding the native input
 * also hides its own built-in filename display.
 */
export function ImageUploadField({ name, label = "Image (optional)" }: { name: string; label?: string }) {
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <label className="flex flex-col gap-1.5 text-xs text-ink-muted">
      {label}
      <span className="flex items-center gap-2">
        <span className="w-fit rounded border border-rule px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-ink/5">
          {fileName ? "Change Image" : "Choose Image"}
        </span>
        <span className="truncate text-xs text-ink-muted">{fileName ?? "No file chosen"}</span>
      </span>
      {/* sr-only, not hidden -- stays focusable/reachable by Tab and a
          screen reader; `display:none` would drop it from the tab
          order entirely since the wrapping <label> itself isn't a
          native tab stop. */}
      <input
        type="file"
        name={name}
        accept="image/*"
        className="sr-only"
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
    </label>
  );
}
