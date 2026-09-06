/**
 * The three YW classes were permanently renamed partway through 2026
 * (Gatherers of Light / Messengers of Hope / Builders of Faith
 * replacing the old age-based YW 12/13, 14/15, 16/17 -- confirmed by
 * the user 2026-09-05, matches the real Church-wide YW class rename).
 * The old age-based values are kept commented out below only so
 * historical rows entered before the rename still make sense if ever
 * displayed raw -- new rows should always use the renamed groups.
 */
export const YOUTH_ACTIVITY_GROUPS = [
  { value: "Deacons", label: "Deacons" },
  { value: "Teachers", label: "Teachers" },
  { value: "Priests", label: "Priests" },
  { value: "Gatherers of Light", label: "Gatherers of Light" },
  { value: "Messengers of Hope", label: "Messengers of Hope" },
  { value: "Builders of Faith", label: "Builders of Faith" },
  // { value: "YW 12/13", label: "YW 12/13" }, -- pre-rename (before ~May 2026)
  // { value: "YW 14/15", label: "YW 14/15" }, -- pre-rename (before ~May 2026)
  // { value: "YW 16/17", label: "YW 16/17" }, -- pre-rename (before ~May 2026)
  { value: "Combined YM", label: "Combined YM" },
  { value: "Combined YW", label: "Combined YW" },
  { value: "Combined YM/YW", label: "Combined YM/YW" },
];

export const YOUTH_DEVELOPMENT_CATEGORIES = [
  { value: "Spiritual", label: "Spiritual" },
  { value: "Physical", label: "Physical" },
  { value: "Social", label: "Social" },
  { value: "Intellectual", label: "Intellectual" },
  { value: "Service", label: "Service" },
];