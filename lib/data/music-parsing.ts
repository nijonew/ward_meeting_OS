import { normalizeMusicType, type MusicTypeValue } from "./sacrament-constants";
import type { PersonOption } from "./people";

export interface ParsedMusicRow {
  raw: string;
  dateText: string;
  dateIso: string | null;
  type: MusicTypeValue | null;
  typeText: string;
  hymnNumber: number | null;
  pieceName: string | null;
  performerText: string | null;
  matchedIndividualId: string | null;
  matchedIndividualName: string | null;
  groupName: string | null;
  accompanistText: string | null;
  matchedAccompanistId: string | null;
  matchedAccompanistName: string | null;
  errors: string[];
}

function parseDateLoose(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  // yyyy-mm-dd, already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  // Build the ISO date from local parts to avoid timezone shifting the day.
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function findPersonMatch(text: string, people: PersonOption[]): PersonOption | null {
  const cleaned = text.trim().toLowerCase();
  if (!cleaned) return null;
  return people.find((p) => p.name.trim().toLowerCase() === cleaned) ?? null;
}

function splitRow(row: string): string[] {
  // Prefer tabs (spreadsheet paste); fall back to commas if no tabs found.
  return row.includes("\t") ? row.split("\t") : row.split(",");
}

export function parseBulkMusicText(text: string, people: PersonOption[]): ParsedMusicRow[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) return [];

  // If the first cell of the first row isn't a parseable date, treat that
  // row as a header and skip it.
  const firstCells = splitRow(lines[0]);
  const startIndex = parseDateLoose(firstCells[0] ?? "") ? 0 : 1;

  return lines.slice(startIndex).map((line) => {
    const cells = splitRow(line).map((c) => c.trim());
    const [dateText = "", typeText = "", hymnText = "", pieceName = "", performerText = "", groupText = "", accompanistText = ""] =
      cells;

    const errors: string[] = [];

    const dateIso = parseDateLoose(dateText);
    if (!dateIso) errors.push("Unrecognized date");

    const type = typeText ? normalizeMusicType(typeText) : null;
    if (typeText && !type) errors.push(`Unrecognized type "${typeText}"`);
    if (!typeText) errors.push("Missing type");

    const hymnNumber = hymnText.trim() ? Number.parseInt(hymnText, 10) : null;
    if (hymnText.trim() && Number.isNaN(hymnNumber)) errors.push("Hymn number isn't a number");

    const performerMatch = performerText ? findPersonMatch(performerText, people) : null;
    const accompanistMatch = accompanistText ? findPersonMatch(accompanistText, people) : null;

    return {
      raw: line,
      dateText,
      dateIso,
      type,
      typeText,
      hymnNumber: Number.isNaN(hymnNumber) ? null : hymnNumber,
      pieceName: pieceName || null,
      performerText: performerText || null,
      matchedIndividualId: performerMatch?.id ?? null,
      matchedIndividualName: performerMatch?.name ?? null,
      groupName: groupText || null,
      accompanistText: accompanistText || null,
      matchedAccompanistId: accompanistMatch?.id ?? null,
      matchedAccompanistName: accompanistMatch?.name ?? null,
      errors,
    };
  });
}