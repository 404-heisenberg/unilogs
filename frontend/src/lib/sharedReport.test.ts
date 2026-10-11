import { describe, expect, it } from 'vitest';
import {
  entriesLabel,
  entryMeta,
  entryPreview,
  formatMinutes,
  groupEntriesByDay,
  insightDisplay,
  normaliseInsights,
  relativeDay,
  shortDate,
  type Insight,
  type ReportEntry,
} from './sharedReport';

function entry(overrides: Partial<ReportEntry> = {}): ReportEntry {
  return { id: 1, date: '2026-09-12', title: null, content: {}, tags: [], ...overrides };
}

function insight(overrides: Partial<Insight>): Insight {
  return { name: 'Field', fieldType: 'number', sampleCount: 3, ...overrides };
}

describe('date helpers', () => {
  it('formats a day as a short date', () => {
    expect(shortDate('2026-09-03')).toBe('3 Sep');
  });

  it('describes a day relative to today', () => {
    expect(relativeDay(null, '2026-09-28')).toBe('—');
    expect(relativeDay('2026-09-28T09:00:00.000Z', '2026-09-28')).toBe('Today');
    expect(relativeDay('2026-09-27T09:00:00.000Z', '2026-09-28')).toBe('Yesterday');
    expect(relativeDay('2026-09-20T09:00:00.000Z', '2026-09-28')).toBe('20 Sep');
  });
});

describe('formatMinutes and entriesLabel', () => {
  it('formats minutes as hours and minutes', () => {
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(120)).toBe('2h');
    expect(formatMinutes(95.4)).toBe('1h 35m');
  });

  it('pluralises entries', () => {
    expect(entriesLabel(1)).toBe('1 entry');
    expect(entriesLabel(4)).toBe('4 entries');
  });
});

describe('normaliseInsights', () => {
  it('accepts an array or an object wrapping one, and ignores anything else', () => {
    const list = [insight({})];
    expect(normaliseInsights(list)).toBe(list);
    expect(normaliseInsights({ insights: list })).toBe(list);
    expect(normaliseInsights({ insights: 'nope' })).toEqual([]);
    expect(normaliseInsights(null)).toEqual([]);
  });
});

describe('insightDisplay', () => {
  it('shows a placeholder when the field has no data', () => {
    expect(insightDisplay(insight({ hasData: false }))).toEqual({ value: '—', sub: 'No data yet' });
  });

  it('formats durations with the trend arrow', () => {
    expect(
      insightDisplay(insight({ valueMinutes: 90, trend: { deltaPct: 20, direction: 'up' } })),
    ).toEqual({ value: '1h 30m', sub: '3 entries ↗' });
  });

  it('formats plain numbers, booleans, dates and strings', () => {
    expect(
      insightDisplay(insight({ value: 2.25, trend: { deltaPct: -5, direction: 'down' } })),
    ).toEqual({ value: '2.3', sub: '3 entries ↘' });
    expect(insightDisplay(insight({ value: true, sampleCount: 1 }))).toEqual({
      value: 'Yes',
      sub: '1 entry',
    });
    expect(insightDisplay(insight({ value: false }))).toEqual({ value: 'No', sub: '3 entries' });
    expect(insightDisplay(insight({ fieldType: 'date', value: '2026-09-14T00:00:00Z' }))).toEqual({
      value: '14 Sep',
      sub: '3 entries',
    });
    expect(insightDisplay(insight({ fieldType: 'text', value: 'Chapter 2' }))).toEqual({
      value: 'Chapter 2',
      sub: '3 entries',
    });
  });

  it('reads the text, yes/no and date shapes the stats service sends', () => {
    const top = [
      { value: 'focused', count: 3 },
      { value: 'tired', count: 1 },
    ];
    expect(insightDisplay(insight({ fieldType: 'text', value: { top } }))).toEqual({
      value: 'Mostly focused',
      sub: '3 entries',
      distribution: top,
    });
    expect(
      insightDisplay(insight({ fieldType: 'text', value: { top: [{ value: 'calm', count: 1 }] } })),
    ).toEqual({ value: 'calm', sub: '3 entries' });
    expect(
      insightDisplay(insight({ fieldType: 'boolean', value: { pctTrue: 80 }, sampleCount: 5 })),
    ).toEqual({ value: '80%', sub: '4 of 5 entries' });
    expect(
      insightDisplay(insight({ fieldType: 'date', value: { mostRecent: '2026-09-15T00:00:00Z' } })),
    ).toEqual({ value: '15 Sep', sub: '3 entries' });
  });

  it('formats aggregate objects', () => {
    expect(insightDisplay(insight({ value: { trueCount: 3, total: 4 } }))).toEqual({
      value: '75%',
      sub: '3 of 4 entries',
    });
    expect(insightDisplay(insight({ value: { total: 12, average: 4 } }))).toEqual({
      value: '12',
      sub: 'avg 4 per entry',
    });
    expect(insightDisplay(insight({ value: { total: 7 } }))).toEqual({
      value: '7',
      sub: '3 entries',
    });
    expect(insightDisplay(insight({ value: undefined }))).toEqual({ value: '—', sub: '3 entries' });
  });
});

describe('groupEntriesByDay', () => {
  it('groups consecutive entries by day with readable labels', () => {
    const groups = groupEntriesByDay(
      [
        entry({ id: 1, date: '2026-09-28T10:00:00Z' }),
        entry({ id: 2, date: '2026-09-28T08:00:00Z' }),
        entry({ id: 3, date: '2026-09-27T08:00:00Z' }),
        entry({ id: 4, date: '2026-09-23T08:00:00Z' }),
      ],
      '2026-09-28',
    );

    expect(groups.map((g) => [g.label, g.entries.map((e) => e.id)])).toEqual([
      ['TODAY — 28 SEP', [1, 2]],
      ['YESTERDAY — 27 SEP', [3]],
      ['WEDNESDAY — 23 SEP', [4]],
    ]);
  });
});

describe('entryMeta', () => {
  it('lists numeric duration and number fields, skipping everything else', () => {
    const fields = [
      { name: 'Hours', fieldType: 'duration' },
      { name: 'Pages', fieldType: 'number' },
      { name: 'Notes', fieldType: 'text' },
      { name: 'Missing', fieldType: 'number' },
    ];
    expect(entryMeta(entry({ content: { Hours: 1.5, Pages: 12, Notes: 'x' } }), fields)).toBe(
      '1h 30m hours · 12 pages',
    );
  });
});

function preview(body: string | null | undefined): string {
  const entry: ReportEntry = {
    id: 1,
    date: '2026-09-12',
    title: null,
    content: {},
    tags: [],
    body,
  };
  return entryPreview(entry);
}

describe('entryPreview', () => {
  it('returns an empty string when there is no body', () => {
    expect(preview(null)).toBe('');
    expect(preview(undefined)).toBe('');
    expect(preview('')).toBe('');
  });

  it('keeps hyphens and brackets that are part of the text (#271)', () => {
    expect(preview('Cross-referenced the related-work section (chapter 2)')).toBe(
      'Cross-referenced the related-work section (chapter 2)',
    );
    expect(preview('Results [draft] - see snake_case_names')).toBe(
      'Results [draft] - see snake_case_names',
    );
  });

  it('uses the first non-empty line', () => {
    expect(preview('\n\n  \nFirst real line\nSecond line')).toBe('First real line');
  });

  it('strips line prefixes: headings, quotes, list and task markers', () => {
    expect(preview('## Session notes')).toBe('Session notes');
    expect(preview('> Supervisor wants the scope narrowed')).toBe(
      'Supervisor wants the scope narrowed',
    );
    expect(preview('- Linear scan works for small sets')).toBe('Linear scan works for small sets');
    expect(preview('* Graph colouring')).toBe('Graph colouring');
    expect(preview('1. Read chapter 3')).toBe('Read chapter 3');
    expect(preview('- [x] Summarise section 3.2')).toBe('Summarise section 3.2');
    expect(preview('- [ ] Rebuild the example graph')).toBe('Rebuild the example graph');
  });

  it('strips inline emphasis, code and link syntax but keeps their text', () => {
    expect(preview('Covered **Keller 2003** and _graph_ construction')).toBe(
      'Covered Keller 2003 and graph construction',
    );
    expect(preview('Use `git rebase` for *clean* history')).toBe(
      'Use git rebase for clean history',
    );
    expect(preview('Reference: [allocation notes](https://example.com/notes)')).toBe(
      'Reference: allocation notes',
    );
    expect(preview('~~old plan~~ new plan')).toBe('old plan new plan');
  });

  it('skips code fences and horizontal rules', () => {
    expect(preview('```\nconst x = 1;\n```')).toBe('const x = 1;');
    expect(preview('---\nAfter the rule')).toBe('After the rule');
  });
});
