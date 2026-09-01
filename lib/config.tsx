/**
 * Ward-level configuration. Kept separate from hardcoded strings so a
 * future multi-ward deployment only has to change this value (or, later,
 * read it from a wards table) rather than touching every page.
 *
 * The app's own product name ("Ward OS") is NOT configurable -- that's
 * the platform, distinct from which ward is using it.
 */
export const WARD_NAME = process.env.NEXT_PUBLIC_WARD_NAME ?? "Ward OS";