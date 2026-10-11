import { describe, expect, it } from 'vitest';
import { weekRange } from '../src/utils/stats-helper.js';

const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

describe('weekRange', () => {
  it('starts on the Monday and ends on the Sunday of a midweek day', () => {
    const { start, end } = weekRange(day('2026-10-07'), day('2026-10-07'));
    expect(start.toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-11T23:59:59.999Z');
  });

  it('keeps a Sunday in its own week instead of jumping to the next Monday', () => {
    const { start, end } = weekRange(day('2026-10-11'), day('2026-10-11'));
    expect(start.toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-11T23:59:59.999Z');
  });

  it('keeps a Monday as its own week start', () => {
    const { start, end } = weekRange(day('2026-10-12'), day('2026-10-12'));
    expect(start.toISOString()).toBe('2026-10-12T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-18T23:59:59.999Z');
  });

  it('spans from the first entry week to the current week', () => {
    const { start, end } = weekRange(day('2026-09-06'), day('2026-10-08'));
    expect(start.toISOString()).toBe('2026-08-31T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-11T23:59:59.999Z');
  });
});
