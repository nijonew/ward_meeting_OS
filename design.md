# Ward OS — Design System

**Direction:** The Ledger (Direction 3 of 3, chosen 2026-09-10)
**Status:** Source of truth for every visual decision from Phase 2 onward. If code and this file disagree, fix the code.

**Implementation status (2026-09-10):** The home page went through the full five-phase
process (direction, structure/motion, copy, assets, polish) and matches this file in every
respect. Every other page in the app then received a second, sitewide pass: the palette and
type tokens (Phase 1), 4px radius, the primary-button accent color, the `LifecycleBadge`
rebuild, a light Calm load-in on each page's own heading, and an app-wide em-dash cleanup in
UI copy. The ledger-index chip (`components/LedgerIndex.tsx`) has since been added to every
grid where row order is real, fixed information -- Assignment Rotations, the Teaching
Calendar, and the Dashboard meeting list -- and deliberately left off Calling Planning, whose
rows are sortable/filterable and have no fixed sequence to number. **Still not yet done:**
destructive-button copy still uses ad hoc red-600/700 rather than the `danger` token. Real,
scoped follow-up work, not an oversight to re-litigate this file over.

---

## Brand & thesis

**Thesis:** Efficient enough for a volunteer's spare hour, quiet enough for Sunday morning.

Ward OS is a planning, organization, and information-sharing tool for a Latter-day Saint ward's
meetings, activities, and events — currently Heritage Ward, Syracuse Utah Stake, built so it
could serve another unit without a source change. It is not a product to be remembered. It is a
tool to disappear into: fast enough that a volunteer's limited prep time goes to substance, not
navigation; calm enough that it never competes with worship.

**The Ledger**, as a direction, treats the meeting itself — not the app — as the thing being
designed. Every screen is organized the way a well-run meeting is organized: in order, numbered
where sequence matters, easy to scan in under a minute. It is the direction for the leader
checking an agenda five minutes before Bishopric Meeting starts, and it stays legible for the
member glancing at Sunday's program.

## Audience & the one job

Two audiences, one interface:

- **Leaders** (bishopric, clerk, exec sec, music/communications specialists, youth leaders) —
  volunteers with real jobs and families, using borrowed time. They need rotations, templates,
  and prior planning already filled in, so their own limited time goes to what only a person can
  add: an inspired thought, a note, a decision. Job: plan and organize meetings, activities, and
  events, fast, without re-deciding what's already settled.
- **Meeting attendees / viewers** — in a worship mindset, not a task mindset. They need the
  basic facts of a meeting (program, announcements, events) without noise, so they can settle in
  and be part of the meeting rather than parse an interface. Job: understand what's happening
  and know how to be part of it.

If a user remembers nothing else: it didn't get in the way.

## Palette (OKLCH, named roles)

One committed accent — a quiet, desaturated wine — used only for the single most important
interactive thing on a screen. Everything else stays neutral. Success and danger are separate,
necessary state colors, not decorative accents, and are never used for emphasis or branding.

| Role | OKLCH | Use |
|---|---|---|
| `paper` | `oklch(96% 0.004 250)` | Page background. Cool, barely-there neutral — never cream, never pure white. |
| `surface` | `oklch(99% 0.002 250)` | Cards, inputs, table zebra — one step lighter than paper. |
| `ink` | `oklch(21% 0.02 260)` | Primary text and icons. Blue-black, never pure `#000`. |
| `ink-muted` | `oklch(46% 0.015 255)` | Secondary text, captions, disabled states. |
| `rule` | `oklch(87% 0.008 250)` | Quiet default border/divider. Used sparingly — see Anti-patterns. |
| `rule-strong` | `oklch(65% 0.02 255)` | The deliberate ledger rule: agenda/row dividers where sequence is the point. Heavier weight (1.5–2px), never used for incidental hairlines. |
| `accent` | `oklch(38% 0.11 20)` | The one accent. Primary buttons, current-stage badge, active nav state, focus ring. |
| `accent-deep` | `oklch(29% 0.1 20)` | Accent hover/pressed. |
| `accent-soft` | `oklch(93% 0.025 20)` | Accent tint — current-item row highlight, selected state background. |
| `success` | `oklch(44% 0.08 150)` | "Saved." confirmations only. Never used for branding or emphasis. |
| `danger` | `oklch(47% 0.14 38)` | Cancellations, destructive actions, validation errors. Distinct hue from accent on purpose — a cancelled meeting must never look like it shares a color with "the important button." |

Do not introduce a second saturated brand color. Do not tint `paper`/`surface` warm — this
direction is deliberately cool and architectural; a warm cast reads as the old cream default.

## Type (display / body / utility)

| Role | Face | Weights | Use |
|---|---|---|---|
| Display | **Archivo** | 600, 700, 800 | Page titles, meeting names, section headings, card titles. Sentence case always. |
| Body | **Public Sans** | 400, 500, 600 | All running copy, labels, form text, descriptions. |
| Utility | **JetBrains Mono** | 400, 500 | Dates, stage/status text, counts, the ledger-index numerals. Real data only. |

**Scale:**

| Token | Size | Line-height | Weight | Example |
|---|---|---|---|---|
| `display-xl` | 2.25rem (1.75rem mobile) | 1.15 | 700 | Home page title |
| `display-l` | 1.5rem | 1.25 | 700 | Page `<h1>` |
| `display-m` | 1.125rem | 1.3 | 600 | Card/tile title |
| `body` | 0.9375rem | 1.6 | 400/500 | Paragraphs, form labels |
| `caption` | 0.8125rem | 1.5 | 400 | Secondary line under a title |
| `mono-label` | 0.6875rem | 1.4 | 500 | Dates, stage text, ledger numerals — uppercase, `0.06em` tracking |

**Do:**
- Use Archivo for anything that names a meeting, a page, or a section.
- Reserve JetBrains Mono for real data (a date, a count, a stage) — never as decoration.
- Keep body copy at 15px minimum even inside dense grids; a rotation grid is still something a
  volunteer reads at the end of a long day.

**Don't:**
- Don't set Archivo in full caps beyond a two-word label — at display weight it turns shouty.
- Don't use mono for headings, body copy, or anything longer than a short data value.
- Don't add a second display face (no serif, no italic-as-flourish, no script).
- Don't use letter-spacing wider than `0.06em` on mono labels — the current app's very wide
  tracking is part of what it's evolving away from.

## Layout & spacing

- Base unit 4px; rhythm in multiples of 8 (8 / 16 / 24 / 32 / 48 / 64).
- Content width: ~48rem for planning/form pages (unchanged from today — it already works for
  dense grids); the home page itself can breathe to ~56rem.
- **Corner radius: 4px, everywhere.** This is a deliberate, visible departure from the current
  app's 8–10px rounded cards — sharper, ruled, architectural. No exceptions for "just this one
  card."
- Cards/tiles: 1px `rule` border, 4px radius, `surface` background, no shadow. Elevation comes
  from spacing and the ledger rule, never from drop-shadow.
- Tables/grids: keep the existing dense grid interaction pattern (it works) — reskin with
  `rule-strong` row dividers and, where order genuinely matters, a ledger-index chip in the
  leading column.

## Signature element

**The ledger index** — a small square numeral chip (mono, tabular figures, 4px radius) that
prefixes anything where position in a sequence is real information: an agenda line's place in
the meeting, a rotation's upcoming order, a Speakers & Music item's slot. Filled `accent`/
`accent-soft` for the current or next item, quiet `ink-muted`-on-`rule` for the rest.

This is the one recurring graphic device in the whole app. It shows up exactly where sequence
is real information and nowhere else — a decorative number badge on a tile that has no order
(like "Announcements") would dilute it. When in doubt, leave it off.

## Motion (structural + polish)

**Structural (Phase 2):** content rises into place on load and on navigation — 8–12px
translate-y plus fade, ~200–250ms, ease-out. No pinning, no scroll-scrubbing, no scroll-jacking.
This is a tool people read and act on, not a story they scroll through.

**Polish (Phase 5):** quiet hover states on rows, buttons, and nav links (background/border
shift only — no scale, no shadow pop); a visible focus ring in `accent`; a save action confirms
with a brief inline label change ("Saving…" → "Saved.") rather than a toast or animation.

**Restraint rule:** if removing a motion effect makes no difference to how fast someone can read
a date, a name, or a status, it's optional — cut it first. Motion must never delay the moment
real information becomes legible.

## Components

- **Buttons** — Primary: `accent` background, `surface` text, 4px radius, no shadow, hover
  `accent-deep`. Secondary: 1px `rule` border, `ink` text, transparent background. Destructive:
  `danger` text/border, revealed after intent (keep the existing "Cancel → reveal reason field"
  pattern, restyled). Buttons always name the action ("Save All Changes," "Open Meeting," never
  "Submit").
- **Tiles** (landing page, hub pages) — `surface` background, 1px `rule` border, 4px radius, no
  shadow. No ledger-index numeral (tiles aren't a sequence).
- **Status badges** (`LifecycleBadge`) — bordered chip in mono; filled `accent` only for the
  *current* stage, `ink-muted`-on-`rule` for past/future stages. No brass-style filled pill for
  every stage — accent is reserved for "this is happening now," not decoration.
- **Grids** (Assignment Rotations, Calling Planning, Teaching Calendar, Dashboard list) —
  unchanged dirty-tracking/Save-All-Changes interaction; reskinned with `rule-strong` row
  dividers and the ledger-index chip in the leading column wherever the row has a real order.
  Calling Planning is the one exception: its rows are sortable/filterable with no fixed
  sequence, so it keeps a plain divider and no chip.
- **Forms/inputs** — 4px radius, 1px `rule` border, `surface` background, `accent` focus ring.

## Copy rules

- Headlines short, sentence case, never restating the section label right below them.
- Captions 3–5 words.
- A concrete, useful statement beats an adjective every time ("Rotations are already filled in"
  beats "Powerful planning tools").
- No invented statistics, testimonials, capabilities, or church policy. If it isn't true today,
  it doesn't go on the page.
- No em dashes, anywhere, in UI copy.
- No jargon, no marketing fluff, no unnecessary feature lists.
- Use real Church/ward terminology already established in this app (calling names, meeting
  types, "ward," "bishopric" for the three-person presidency specifically) — never invent a term
  the app doesn't already use.
- Stay in the tool's own voice: plain, calm, useful, respectful, understated. It reads like
  something a clerk wrote, not something a marketer wrote.

## Assets plan

This is a planning tool, not a publication — the assets budget is small and deliberate.

- **No stock photography anywhere.** No temples, no praying hands, no generic "diverse people
  in a meeting" stock imagery. It would read as decoration bolted onto a utility, and it risks
  looking like every other church-adjacent template.
- **Home hero:** a single quiet graphic motif — a set of thin, evenly-spaced horizontal ledger
  rules (echoing the signature element), rendered as inline SVG, tinted `rule`/`rule-strong` on
  `paper`. Not a photo, not an illustration of a person or building — an abstraction of "an
  ordered list," which is what the app actually is.
  Source: hand-built SVG, sized to the hero container, generated in Phase 4.
- **Favicon:** a small monogram mark (a single ledger-index chip shape with "W" or a tally-mark
  motif), flat, two colors max (`ink` on `paper` or `accent` on `surface`), no gradient, no
  photographic elements. Generated in Phase 4, not before.
- **No icon library import.** Where a small glyph is genuinely useful (a chevron, a checkmark),
  hand-drawn inline SVG at 1.5px stroke, matching the ledger line-weight — not a generic icon
  pack that would dilute the one signature element.

## Conversion essentials

Not a marketing site, so "conversion" means: the next real action is always obvious.

- Exactly one primary action per screen, styled `accent`, labeled with the actual verb ("Save
  All Changes," "Open Meeting," "Sign in") — never "Submit," never "Click here."
- Secondary actions (Cancel, Show all types, back-links) stay visually quiet — `ink-muted` text,
  no border competing with the real primary button.
- A logged-out visitor always has one clear path forward: sign in, or read today's program —
  never both competing for the same visual weight.

## Anti-patterns

Global bans, restated for this app:

- No gradient text. No glassmorphism. No gratuitous shadows. No excessive rounding (4px, not
  more, ever).
- No identical card grids pretending every tile is equally important — vary emphasis by what
  the tile actually is (a live "This week" program is not the same weight as a Table Admin link).
- No generic AI-SaaS look: no Inter body, no near-black-plus-neon-accent, no cream-serif-brass
  (the app's own starting point — this direction exists specifically to move past it).
- No broadsheet hairlines used as decoration. `rule` exists for quiet, incidental separation;
  `rule-strong` exists for the one deliberate ledger structure. If every row on a page has a
  hairline under it "just because," that's the old pattern creeping back in.
- No emoji bullets, ever.
- Never pure `#000` or `#fff` — always the `ink`/`paper` OKLCH tokens above.
- No decorative use of the ledger-index chip — it appears only where sequence is real
  information.
- No em dashes anywhere in UI copy.
- Buttons always name the actual action.
- Important information (a date, a name, an assignment, a status) must always stay immediately
  legible — no motion, color, or layout choice may cost scannability for visual interest.

## References

- `churchofjesuschrist.org` (fetched live, 2026-09-10) — real tokens observed: humanist sans
  body/display face (brand face "Ensign Sans"), deep teal-blue primary accent `rgb(0,97,132)`,
  off-black body text `rgb(33,34,37)` on white, 4px button corner radius, card-grid layout with
  generous whitespace. The Ledger borrows the *restraint and structure* of this reference —
  clean sans, small corner radius, one committed accent, no ornamentation — while choosing its
  own wine accent and cooler neutral rather than copying the Church site's literal teal, so Ward
  OS reads as its own tool rather than a reskin of churchofjesuschrist.org.
- The existing app (`app/globals.css`, `components/rotations/AssignmentGridForm.tsx`,
  `components/Tile.tsx`, `components/LifecycleBadge.tsx`) as the functional baseline this
  redesign evolves rather than replaces — the dirty-tracking grid pattern, the tile-grid
  navigation model, and the lifecycle-stage badge concept all carry forward unchanged in
  mechanics, restyled in appearance only.
