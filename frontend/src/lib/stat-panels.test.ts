import { describe, expect, it } from 'vitest';
import { entryWord, formatStatValue } from './stat-panels';
import type { FieldDefinition } from '@/types';

const fields: FieldDefinition[] = [
  { id: 1, projectId: 1, name: 'Pages read', fieldType: 'number' },
  { id: 2, projectId: 1, name: 'Time spent', fieldType: 'duration' },
  { id: 3, projectId: 1, name: 'Reading time', fieldType: 'duration' },
  { id: 4, projectId: 1, name: 'Writing time', fieldType: 'duration' },
];

describe('formatStatValue', () => {
  it('shows a single duration field as hours and minutes', () => {
    expect(formatStatValue(1.5, 'Time spent', fields)).toBe('1h 30m');
  });

  it('ignores spacing around a single duration field', () => {
    expect(formatStatValue(2, '  Time spent  ', fields)).toBe('2h');
  });

  it('shows any other formula as a plain number', () => {
    expect(formatStatValue(32, 'Pages read / Time spent', fields)).toBe('32');
  });

  it('rounds decimals to one place', () => {
    expect(formatStatValue(32.456, 'Pages read / Time spent', fields)).toBe('32.5');
  });

  it('treats a number field on its own as a plain number', () => {
    expect(formatStatValue(40, 'Pages read', fields)).toBe('40');
  });

  it('keeps time when a duration is scaled by a plain number', () => {
    expect(formatStatValue(3, 'Time spent * 2', fields)).toBe('3h');
    expect(formatStatValue(3, '2 * Time spent', fields)).toBe('3h');
    expect(formatStatValue(3, 'Time spent / 2', fields)).toBe('3h');
  });

  it('keeps time when durations are added together', () => {
    expect(formatStatValue(4, 'Reading time + Writing time', fields)).toBe('4h');
    expect(formatStatValue(4, '(Reading time + Writing time) * 2', fields)).toBe('4h');
  });

  it('shows a plain number when time is divided by time', () => {
    expect(formatStatValue(1, 'Time spent / Time spent', fields)).toBe('1');
  });

  it('does not call a mix of time and counts time', () => {
    expect(formatStatValue(5, 'Time spent + Pages read', fields)).toBe('5');
    expect(formatStatValue(5, 'Time spent * Time spent', fields)).toBe('5');
  });

  it('falls back to a plain number for formulas it cannot read', () => {
    expect(formatStatValue(5, 'Mystery * 2', fields)).toBe('5');
    expect(formatStatValue(5, 'Time spent +', fields)).toBe('5');
  });
});

describe('entryWord', () => {
  it('uses the singular for one entry', () => {
    expect(entryWord(1)).toBe('1 entry');
  });

  it('uses the plural otherwise', () => {
    expect(entryWord(0)).toBe('0 entries');
    expect(entryWord(18)).toBe('18 entries');
  });
});
