export type Insight = {
  name: string;
  fieldType: string;
  family?: string;
  value?: unknown;
  valueMinutes?: number;
  trend?: { deltaPct: number | null; direction: 'up' | 'down' | 'flat' | null };
  sampleCount: number;
  hasData?: boolean;
};

export type ReportField = { name: string; fieldType: string };

export type ReportEntry = {
  id: number;
  date: string;
  title: string | null;
  content: Record<string, unknown>;
  tags: string[];
  body?: string | null;
};

export type ReportSummary = {
  entryCount: number;
  trackedTimeMinutes: number | null;
  lastLoggedAt: string | null;
  entriesThisWeek: number;
};

export type SharedReport = {
  project: { id: number; name: string; description: string | null };
  includeBodies: boolean;
  rangeDays: number;
  dateFrom: string;
  dateTo: string;
  fields: ReportField[];
  summary: ReportSummary | null;
  insights: unknown;
  entries: ReportEntry[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function shortDate(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export function relativeDay(iso: string | null, today: string): string {
  if (!iso) return '—';
  const day = dayKey(iso);
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  return shortDate(day);
}

export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function entriesLabel(count: number): string {
  return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}

export function normaliseInsights(raw: unknown): Insight[] {
  if (Array.isArray(raw)) return raw as Insight[];
  if (raw && typeof raw === 'object') {
    const nested = (raw as { insights?: unknown }).insights;
    if (Array.isArray(nested)) return nested as Insight[];
  }
  return [];
}

export function insightDisplay(insight: Insight): { value: string; sub: string } {
  if (insight.hasData === false) return { value: '—', sub: 'No data yet' };

  const count = entriesLabel(insight.sampleCount);
  const direction = insight.trend?.direction;
  const arrow = direction === 'up' ? ' ↗' : direction === 'down' ? ' ↘' : '';

  if (typeof insight.valueMinutes === 'number') {
    return { value: formatMinutes(insight.valueMinutes), sub: `${count}${arrow}` };
  }

  const value = insight.value;
  if (typeof value === 'number') return { value: formatNumber(value), sub: `${count}${arrow}` };
  if (typeof value === 'boolean') return { value: value ? 'Yes' : 'No', sub: count };
  if (typeof value === 'string') {
    if (insight.fieldType === 'date' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return { value: shortDate(dayKey(value)), sub: count };
    }
    return { value, sub: count };
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (
      typeof record.trueCount === 'number' &&
      typeof record.total === 'number' &&
      record.total > 0
    ) {
      const percent = Math.round((record.trueCount / record.total) * 100);
      return { value: `${percent}%`, sub: `${record.trueCount} of ${record.total} entries` };
    }
    if (typeof record.total === 'number' && typeof record.average === 'number') {
      return {
        value: formatNumber(record.total),
        sub: `avg ${formatNumber(record.average)} per entry${arrow}`,
      };
    }
    if (typeof record.total === 'number') {
      return { value: formatNumber(record.total), sub: `${count}${arrow}` };
    }
  }

  return { value: '—', sub: count };
}

export type EntryGroup = { day: string; label: string; entries: ReportEntry[] };

function dayLabel(day: string, today: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const short = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()].toUpperCase()}`;
  if (day === today) return `TODAY — ${short}`;
  if (day === addDays(today, -1)) return `YESTERDAY — ${short}`;
  return `${WEEKDAYS[date.getUTCDay()].toUpperCase()} — ${short}`;
}

export function groupEntriesByDay(entries: ReportEntry[], today: string): EntryGroup[] {
  const groups: EntryGroup[] = [];
  for (const entry of entries) {
    const day = dayKey(entry.date);
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.entries.push(entry);
    } else {
      groups.push({ day, label: dayLabel(day, today), entries: [entry] });
    }
  }
  return groups;
}

// Duration fields are stored in hours (same assumption as the dashboard).
export function entryMeta(entry: ReportEntry, fields: ReportField[]): string {
  const parts: string[] = [];
  for (const field of fields) {
    const value = entry.content[field.name];
    if (typeof value !== 'number') continue;
    if (field.fieldType === 'duration')
      parts.push(`${formatMinutes(value * 60)} ${field.name.toLowerCase()}`);
    else if (field.fieldType === 'number') parts.push(`${value} ${field.name.toLowerCase()}`);
  }
  return parts.join(' · ');
}

export function entryPreview(entry: ReportEntry): string {
  if (!entry.body) return '';
  const firstLine = entry.body
    .split('\n')
    .map((line) => line.replace(/[#*_`>[\]()-]/g, '').trim())
    .find((line) => line !== '');
  return firstLine ?? '';
}

const TAG_STYLES = [
  'bg-[#D4A843] text-[#1c0d06]',
  'bg-[#4A7FC1] text-white',
  'bg-[#5B8C6B] text-white',
];

export function tagStyle(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TAG_STYLES[hash % TAG_STYLES.length];
}
