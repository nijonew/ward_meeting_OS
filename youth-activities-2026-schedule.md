# Youth Activities — 2026 Combined-Week Schedule (reference data)

Pasted by the user 2026-09-05 as the concrete rotation data for the
"Adult leaders planning youth activities" workflow in
[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md). Kept in its own file (not
inline in PROJECT_CONTEXT.md) since it's a literal one-year dataset,
not an architecture decision — PROJECT_CONTEXT.md links here rather
than duplicating it.

**Built 2026-09-05** once the user supplied the missing cadence rule
(Wednesdays 7pm; Combined YM = 1st Wed; Combined YW = 2nd & 4th;
Combined YM/YW = 3rd) and said to continue — see PROJECT_CONTEXT.md's
workflow entry for what shipped (migration `032`, the
`youth_activity_rotations` engine, `/youth-activities`' Generate panel,
confirmed/cancelled controls). This file's analysis below is what that
build was based on. Individual-group (non-combined) weekly activities
still have no rotation provided and remain unbuilt.

## Group naming — decided 2026-09-05

`YW 12-13` / `YW 14-15` / `YW 16-17` were **permanently renamed** to
`Gatherers of Light` / `Messengers of Hope` / `Builders of Faith`
partway through 2026 (matches the real Church-wide Young Women class
rename). The transition shows up mid-table below (Feb–Apr 2026 uses
the old names; May 2026 onward uses the new ones). Once this workflow
is built, `YOUTH_ACTIVITY_GROUPS`
(`lib/data/youth-activity-constants.ts`) should be updated to the three
named groups; the old age-based values only matter for reading
historical rows entered before the rename.

## Rotation-override design — decided 2026-09-05

Combined YM's November→December 2026 sequence repeats Teachers back to
back, breaking the clean 3-month cycle — confirmed **intentional, but
a one-off exception, not a change to the underlying rotation**. The
user's own words: "changes like that should be an option by dropdown,
much like several other elements that are assigned by rotation, but
can be adjusted by the user." This is exactly the existing
`/rotations` design already documented in PROJECT_CONTEXT.md's
Architecture section — a rotation's "next" pointer advances once per
occurrence *created*, not per save, so a one-off manual override (via
dropdown) doesn't skip anyone in future occurrences. Confirms the same
pattern should be reused here rather than inventing a new one: automate
the base cycle, let an admin override any single instance without
disturbing the pointer.

## Automation scope — decided 2026-09-05

All three combined-week patterns should eventually be automated (not
just the two clean monthly ones) — including Combined YW, despite its
schedule being visibly less regular (variable 1–2 dates/month, plus
multi-day specials like Camp and Youth Conference that aren't normal
Wednesday-night slots). Exactly how to encode Combined YW's rotation
still needs to be settled once building starts — see "Combined YW"
analysis below for what a clean base cycle might look like once the
transition-period and special-event rows are treated as one-off
overrides rather than pattern data.

**Category note (2026-09-06):** `youth_activities.development_category`
has a pre-existing check constraint limited to
`YOUTH_DEVELOPMENT_CATEGORIES`'s single values (Spiritual/Physical/
Social/Intellectual/Service). The tables below keep the user's original
compound categories (e.g. "Physical/Social") verbatim as given; the
actual seeded rows in migration `032` narrow each to its single closest
category instead, since every other row in this table already assumes
one.

---

## Combined YM/YW (monthly — third Wednesday)

Clean 6-month repeating cycle: **Gatherers of Light → Teachers →
Messengers of Hope → Builders of Faith → Deacons → Priests → repeat.**
(Read as the planning-responsible group for an activity attended by all
YM + YW combined, per the workflow's "rotations of which groups *plan*
which events.")

| Month | Group | Activity (tentative) | Category |
|---|---|---|---|
| March 2026 | Gatherers of Light | Service | Service |
| April 2026 | Teachers | BOM Cake Decorating Contest | Social |
| May 2026 | Messengers of Hope | Where's Waldo | Physical/Social |
| June 2026 | Builders of Faith | Swimming | Physical/Social |
| July 2026 | Deacons | Dodgeball | Physical |
| August 2026 | Priests | Water Kickball | Physical/Social |
| September 2026 | Gatherers of Light | Youth Conference 18–20 / Temple Trip | Spiritual |
| October 2026 | Teachers | Capture the Flag | Physical/Social |
| November 2026 | Messengers of Hope | Etiquette Dinner | Social/Intellectual |
| December 2026 | Builders of Faith | Service/Care Packages/Sub for Santa | Service |
| January 2027 | Deacons | Bowling | Physical/Social |
| February 2027 | Priests | USU Tour | Intellectual/Social |

Note: September's "Youth Conference 18–20 / Temple Trip" is a
multi-day event, not a normal single Wednesday-night slot — flag as an
exception when building the generator, not pattern data.

## Combined YM (monthly — first Wednesday)

Clean 3-month repeating cycle: **Deacons → Priests → Teachers →
repeat.** December 2026 is a confirmed one-off override (see
"Rotation-override design" above) — the underlying pointer should
continue as if December had been Deacons (matches January 2027 =
Deacons, February 2027 = Priests, exactly where the clean cycle would
land if the override hadn't happened).

| Month | Group | Activity (tentative) | Category |
|---|---|---|---|
| March 2026 | Deacons | Scripture chase/jeopardy/scavenger hunt | Spiritual |
| April 2026 | Priests | Karaoke | Social |
| May 2026 | Teachers | Temple Trip | Spiritual |
| June 2026 | Deacons | Adam Canyon Hike | Physical |
| July 2026 | Priests | Swimming | Physical |
| August 2026 | Teachers | Frisbee golf | Physical |
| September 2026 | Deacons | Internet-based game | Intellectual/Social |
| October 2026 | Priests | Tour MTC | Spiritual |
| November 2026 | Teachers | Glow in the dark Frisbee | Physical |
| December 2026 | **Teachers (override — see above)** | Indoor hockey | Physical |
| January 2027 | Deacons | Ice fishing | Physical/Intellectual |
| February 2027 | Priests | Tour Hanks work | Intellectual |

## Combined YW (twice monthly)

Visibly the least regular of the three — mixes the April→May 2026
group rename, two apparent one-off special events (a multi-class
activity and a multi-day Camp), and a real cadence gap (only one date
in February and April 2026, not two). **Not yet reduced to a clean base
cycle + exceptions** the way the other two tables were above — from
August 2026 onward it does look like a stable 3-slot repeating cycle
(**Gatherers of Light → Messengers of Hope → Builders of Faith →
repeat**, one class per twice-monthly slot), but May–July 2026 doesn't
fit that same pattern cleanly and shouldn't be forced into it without
asking the user first when this gets built.

| Month | Group | Activity (tentative) | Date |
|---|---|---|---|
| February 2026 | YW 12-13 | Heart attacks | Feb 25 |
| March 2026 | YW 14-15 | Yoga/Zumba | Mar 11 |
| March 2026 | YW 16-17 | Magnets | Mar 25 |
| April 2026 | YW 12-13 | "He is Risen" scavenger hunt | Apr 22 |
| May 2026 | Gatherers of Light | Nature walk activity | May 13 |
| May 2026 | Messengers of Hope | Temple Trip, 7:30pm session | May 27 |
| June 2026 | YW 12-15 | Book of Mormon decorating | Jun 10 |
| June 2026 | Gatherers of Light | Cultural day — Missionaries? | Jun 24 |
| July 2026 | Messengers of Hope | Chair Soccer — outside | Jul 8 |
| July 2026 | YW 12-17 | Camp | Jul 29 |
| August 2026 | Builders of Faith | Pool day / Swimming | Aug 12 |
| August 2026 | Gatherers of Light | Seminary Prep | Aug 26 |
| September 2026 | Messengers of Hope | Post Camp Party | Sep 9 |
| September 2026 | Builders of Faith | Self care / Spa day | Sep 23 |
| October 2026 | Gatherers of Light | Interior Design night | Oct 14 |
| October 2026 | Messengers of Hope | Ward party / Halloween? | Oct 28 |
| November 2026 | Builders of Faith | Volleyball lesson / play Volleyball | Nov 11 |
| December 2026 | Gatherers of Light | "Bunko" Game activity | Dec 9 |

Flags for whenever this gets built (don't guess at these blind):
- `YW 12-15` (Jun 10) and `YW 12-17` (Jul 29, Camp) are multi-class
  combinations that don't match either the single-class rotation
  pattern or the "all YM+YW combined" pattern used elsewhere — likely
  one-off special events, but confirm before modeling them as anything
  systematic.
- Only one date in February and April 2026 (not two) — confirm whether
  that's a real single-activity month or a second date just wasn't
  given.
