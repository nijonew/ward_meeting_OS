/**
 * Pure constants shared between lib/data/rotations.ts (server-only --
 * imports next/headers via createClient) and client components that
 * need the same value without pulling that server-only module into
 * their own bundle. Same split this app already uses for
 * lib/data/sacrament-program.ts / sacrament-program-shared.ts, for the
 * identical reason: a type-only import erases at compile time and is
 * safe from a client component, but a real VALUE import of anything
 * from rotations.ts drags its createClient/next-headers import along
 * with it -- found 2026-10-31 when AssignmentGridForm.tsx needed
 * UNLISTED_CALLING_VALUE as an actual runtime value, not just a type.
 */
export const UNLISTED_CALLING_VALUE = "__unlisted__";
