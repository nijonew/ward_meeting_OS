import { useRef } from "react";
import { resolveHymnTitle, type HymnalIndexEntry } from "@/lib/data/hymnal-shared";

/**
 * Wires a hymn-number input to live-fill a sibling title input from
 * Music Reference (2026-10-03, the user's own request: "If I put in a
 * hymn number please then pre-fill the name next to it"). Returns a
 * change handler for the number field, plus a ref the title field
 * itself needs attached.
 *
 * **Bug fixed 2026-10-03** (the user's own report: "I started to type
 * 121 and it only recognized the 1 and brought up the corresponding
 * hymn number 1 title. Then when I deleted the 121 the hymn number 1
 * title stayed"). The original version only auto-filled when the title
 * field was *blank* -- works for the first digit, but the moment that
 * digit fills the title, every later digit's own "is it blank" check
 * comes back false, even though nothing the user actually typed is in
 * there. This tracks the exact value *this hook* last wrote into the
 * title field instead: a later keystroke can tell "still holds what I
 * filled last time, safe to replace" apart from "the user has since
 * typed their own title here, leave it alone." An unresolved number
 * clears the title back to blank (rather than leaving a stale,
 * no-longer-matching title showing) -- the user's own second report,
 * deleting the number should clear the title that came from it.
 */
export function useHymnTitleLiveFill(hymnalIndex: HymnalIndexEntry[]) {
  const titleRef = useRef<HTMLInputElement>(null);
  const lastAutoFilledRef = useRef("");

  const onNumberChange = (raw: string) => {
    const titleInput = titleRef.current;
    if (!titleInput) return;
    if (titleInput.value !== lastAutoFilledRef.current) return; // the user's own title -- never touch it
    const title = resolveHymnTitle(raw, hymnalIndex) ?? "";
    titleInput.value = title;
    lastAutoFilledRef.current = title;
  };

  return { titleRef, onNumberChange };
}
