export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Parses a duration a user typed into hours, or null when blank or invalid.
 * Accepts "2:30" (H:MM), plain hours "2" / "2.5", and text like "1h 30m",
 * "45m" and "1.5h". Combines with `formatDurationHours` in the dashboards lib
 * for display; this is the input side of a duration field.
 */
export function parseDurationHours(raw: string): number | null {
  const value = raw.trim();
  if (value === '') return null;

  const colon = /^(\d+):([0-5]\d)$/.exec(value);
  if (colon) return Number(colon[1]) + Number(colon[2]) / 60;

  const plain = Number(value);
  if (Number.isFinite(plain)) return plain;

  const text = /^(?:(\d+(?:\.\d+)?)h)?\s*(?:(\d+(?:\.\d+)?)m)?$/i.exec(value);
  if (text && (text[1] !== undefined || text[2] !== undefined)) {
    return Number(text[1] ?? 0) + Number(text[2] ?? 0) / 60;
  }

  return null;
}
