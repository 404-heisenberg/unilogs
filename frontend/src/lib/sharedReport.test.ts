import { describe, expect, it } from 'vitest';
import { entryPreview, type ReportEntry } from './sharedReport';

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
