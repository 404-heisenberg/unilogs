// Up to two letters from the first and last name, e.g. "Renda M" -> "RM".
// Taking the first and last rather than the first two means "Mary Jane Watson"
// reads as "MW" instead of "MJ", which is the convention users expect from an
// avatar badge.
export function initialsFromName(name: string | null | undefined) {
  if (!name) return '';

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();

  const first = parts[0]![0] ?? '';
  const last = parts[parts.length - 1]![0] ?? '';
  return (first + last).toUpperCase();
}
