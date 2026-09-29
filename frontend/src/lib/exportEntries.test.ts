import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Entry, FieldDefinition } from '@/types';
import { downloadTextFile, entriesToCSV, entriesToMarkdown } from './exportEntries';

const FIELDS: FieldDefinition[] = [
  { id: 1, projectId: 1, name: 'Hours', fieldType: 'duration' },
  { id: 2, projectId: 1, name: 'Summary', fieldType: 'text' },
];

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    projectId: 1,
    date: '2026-09-14T00:00:00.000Z',
    createdAt: '2026-09-14T08:00:00.000Z',
    title: 'Literature review',
    body: 'Read two papers',
    content: { Hours: 2, Summary: 'Good progress' },
    tags: [{ tag: { id: 1, name: 'research' } }, { tag: { id: 2, name: 'reading' } }],
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('entriesToCSV', () => {
  it('writes a header row and one row per entry', () => {
    expect(entriesToCSV([entry()], FIELDS)).toBe(
      'Date,Title,Notes,Hours,Summary,Tags\n2026-09-14,Literature review,Read two papers,2,Good progress,research; reading',
    );
  });

  it('quotes cells containing commas, quotes or newlines, and blanks missing values', () => {
    const csv = entriesToCSV(
      [
        entry({
          title: null,
          body: 'Line one\nLine "two", done',
          content: {},
          tags: undefined,
        }),
      ],
      FIELDS,
    );
    expect(csv.split('\n').slice(1).join('\n')).toBe(
      '2026-09-14,,"Line one\nLine ""two"", done",,,',
    );
  });
});

describe('entriesToMarkdown', () => {
  it('writes a heading per entry with its notes, fields and tags', () => {
    const md = entriesToMarkdown([entry()], FIELDS, 'Thesis');
    expect(md).toContain('# Thesis');
    expect(md).toContain('## Literature review');
    expect(md).toContain('*2026-09-14*');
    expect(md).toContain('Read two papers');
    expect(md).toContain('- **Hours:** 2');
    expect(md).toContain('- **Summary:** Good progress');
    expect(md).toContain('- **Tags:** research, reading');
  });

  it('falls back to the date as the heading and skips empty parts', () => {
    const md = entriesToMarkdown(
      [entry({ title: null, body: null, content: { Summary: '' }, tags: [] })],
      FIELDS,
      'Thesis',
    );
    expect(md).toContain('## 2026-09-14');
    expect(md).not.toContain('**Summary:**');
    expect(md).not.toContain('**Tags:**');
  });
});

describe('downloadTextFile', () => {
  it('clicks a temporary link to the file and cleans it up', () => {
    const createObjectURL = vi.fn(() => 'blob:export');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadTextFile('thesis.csv', 'a,b', 'text/csv');

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
    expect(document.querySelector('a[download]')).toBeNull();

    vi.unstubAllGlobals();
  });
});
