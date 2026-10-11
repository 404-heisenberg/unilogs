import { describe, expect, it } from 'vitest';
import {
  describeFieldFilter,
  entryFieldPairs,
  fieldFilterParams,
  filterSummary,
  formatFieldValue,
} from './entryFields';
import { DEFAULT_FILTERS, buildEntriesQuery, describeFilters } from './entryFilters';

describe('formatFieldValue', () => {
  it('formats each field type and skips empty values', () => {
    expect(formatFieldValue(2.5, 'duration')).toBe('2h 30m');
    expect(formatFieldValue(true, 'boolean')).toBe('Yes');
    expect(formatFieldValue(false, 'boolean')).toBe('No');
    expect(formatFieldValue('2026-09-22', 'date')).toBe('22 Sep');
    expect(formatFieldValue(1200, 'number')).toBe((1200).toLocaleString());
    expect(formatFieldValue('  focused ', 'text')).toBe('focused');
    expect(formatFieldValue('', 'text')).toBeNull();
    expect(formatFieldValue(undefined, 'number')).toBeNull();
  });
});

describe('entryFieldPairs', () => {
  it('lists filled-in fields in the project’s order', () => {
    const fields = [
      { name: 'Time', fieldType: 'duration' },
      { name: 'Mood', fieldType: 'text' },
      { name: 'Pages', fieldType: 'number' },
    ];

    expect(entryFieldPairs({ Pages: 12, Mood: '', Time: 1 }, fields)).toEqual([
      { name: 'Time', text: '1h' },
      { name: 'Pages', text: '12' },
    ]);
  });

  it('falls back to the stored keys when field types are unknown', () => {
    expect(entryFieldPairs({ Reps: 12 }, undefined)).toEqual([{ name: 'Reps', text: '12' }]);
  });
});

describe('field filter', () => {
  it('sends only the parts that are filled in', () => {
    expect(fieldFilterParams({ name: 'Pages', fieldType: 'number', min: '20', max: ' ' })).toEqual({
      field: 'Pages',
      min: '20',
    });
    expect(fieldFilterParams({ name: 'Pages', fieldType: 'number' })).toEqual({});
    expect(fieldFilterParams(null)).toEqual({});
  });

  it('describes the filter in words', () => {
    expect(describeFieldFilter({ name: 'Mood', fieldType: 'text', value: 'calm' })).toBe(
      'Mood contains “calm”',
    );
    expect(describeFieldFilter({ name: 'Time', fieldType: 'duration', min: '1', max: '2.5' })).toBe(
      'Time is 1h to 2h 30m',
    );
    expect(describeFieldFilter({ name: 'Done', fieldType: 'boolean', value: 'false' })).toBe(
      'Done is No',
    );
    expect(describeFieldFilter({ name: 'Due', fieldType: 'date', max: '2026-09-30' })).toBe(
      'Due is at most 30 Sep',
    );
  });
});

describe('timeline filters', () => {
  it('sends a field filter only along with its project', () => {
    const field = { name: 'Pages', fieldType: 'number', min: '20' };

    expect(buildEntriesQuery({ ...DEFAULT_FILTERS, field })).toBe('?limit=100');
    expect(buildEntriesQuery({ ...DEFAULT_FILTERS, projectId: 3, field })).toBe(
      '?projectId=3&field=Pages&min=20&limit=100',
    );
  });

  it('says every filter must hold', () => {
    const parts = describeFilters(
      {
        ...DEFAULT_FILTERS,
        projectId: 3,
        field: { name: 'Pages', fieldType: 'number', min: '20' },
        dateRange: '7d',
        tagIds: [9],
      },
      { project: () => 'Thesis', tag: () => 'reading' },
    );

    expect(filterSummary(parts)).toBe(
      'Showing entries that match all of: in Thesis, Pages is at least 20, tagged reading and from last 7 days.',
    );
    expect(filterSummary([])).toBeNull();
  });
});
