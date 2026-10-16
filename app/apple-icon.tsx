import { ImageResponse } from "next/og";
import { getSeasonTheme } from "@/lib/data/season-theme";
import { ICON_BACKGROUND_BY_SEASON, ICON_FOREGROUND, TEMPLE_SILHOUETTE_PATH, TEMPLE_SILHOUETTE_VIEW_BOX } from "@/lib/icons/temple-silhouette";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
// See app/icon.tsx's own comment -- without this, Next.js would freeze
// the season at whatever it was during the last build.
export const dynamic = "force-dynamic";

/**
 * The iOS/PWA home-screen icon -- same silhouette, season, and color
 * logic as app/icon.tsx (the browser-tab favicon), just at Apple's own
 * recommended 180x180 size. Deliberately no border-radius here, unlike
 * the favicon -- iOS applies its own rounded-square mask automatically
 * to apple-touch-icons, so a pre-rounded image would either show a
 * visible background-color edge inside that mask or get double-rounded;
 * Apple's own guidance is to fill the full square and let the OS do it.
 */
export default async function AppleIcon() {
  const season = getSeasonTheme();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: ICON_BACKGROUND_BY_SEASON[season],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="70%" height="70%" viewBox={TEMPLE_SILHOUETTE_VIEW_BOX}>
          <path d={TEMPLE_SILHOUETTE_PATH} fill={ICON_FOREGROUND} />
        </svg>
      </div>
    ),
    { ...size }
  );
}
