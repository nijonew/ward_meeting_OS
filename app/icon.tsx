import { ImageResponse } from "next/og";
import { getSeasonTheme } from "@/lib/data/season-theme";
import { ICON_BACKGROUND_BY_SEASON, ICON_FOREGROUND, TEMPLE_SILHOUETTE_PATH, TEMPLE_SILHOUETTE_VIEW_BOX } from "@/lib/icons/temple-silhouette";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
// Without this, Next.js statically generates the icon once at build
// time (since getSeasonTheme() reads only the clock, no request-bound
// API) and would then serve that one frozen season forever -- the
// entire point of this being dynamic instead of three static files.
export const dynamic = "force-dynamic";

/**
 * The browser-tab favicon -- replaces the old static `app/icon.svg`
 * (a plain "W" monogram) with a silhouette of the Syracuse Utah
 * Temple, on this app's own seasonal accent color (2026-10-16, the
 * user's own request -- see lib/icons/temple-silhouette.ts for the
 * silhouette's own history and app/layout.tsx's `data-season` wiring
 * for how the rest of the app already does this same seasonal
 * rotation). Replacing the static file with this dynamic route (Next's
 * own `icon.tsx` convention, rendered through Satori via `ImageResponse`)
 * is what makes "probably more than one icon" come from a single
 * source instead of three files someone has to remember to swap --
 * `getSeasonTheme()` is computed fresh on every request, the exact
 * same function `app/layout.tsx` already calls for the rest of the
 * site's own color rotation, so the favicon can never drift out of
 * sync with it.
 *
 * Checked directly before shipping (not just assumed): rendered this
 * same path at real 32px/16px via a canvas, scaled up with
 * `image-rendering: pixelated` so the actual pixel result was visible
 * -- the silhouette stays legible at both sizes.
 */
export default async function Icon() {
  const season = getSeasonTheme();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: ICON_BACKGROUND_BY_SEASON[season],
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="75%" height="75%" viewBox={TEMPLE_SILHOUETTE_VIEW_BOX}>
          <path d={TEMPLE_SILHOUETTE_PATH} fill={ICON_FOREGROUND} />
        </svg>
      </div>
    ),
    { ...size }
  );
}
