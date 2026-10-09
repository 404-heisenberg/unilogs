import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime, parseDurationHours } from './time';

const NOW = new Date('2026-09-28T12:00:00.000Z');

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('formatRelativeTime', () => {
  it('describes recent times in minutes and hours', () => {
    expect(formatRelativeTime(minutesAgo(0))).toBe('Just now');
    expect(formatRelativeTime(minutesAgo(5))).toBe('5m ago');
    expect(formatRelativeTime(minutesAgo(3 * 60))).toBe('3h ago');
  });

  it('describes older times in days', () => {
    expect(formatRelativeTime(minutesAgo(24 * 60))).toBe('Yesterday');
    expect(formatRelativeTime(minutesAgo(3 * 24 * 60))).toBe('3d ago');
  });

  it('falls back to a short date after a week', () => {
    const iso = minutesAgo(10 * 24 * 60);
    expect(formatRelativeTime(iso)).toBe(
      new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    );
  });
});

describe('parseDurationHours', () => {
  it('accepts clock times as H:MM', () => {
    expect(parseDurationHours('2:30')).toBe(2.5);
    expect(parseDurationHours('0:45')).toBe(0.75);
    expect(parseDurationHours('01:05')).toBeCloseTo(1.0833, 4);
  });

  it('accepts plain hours and decimals', () => {
    expect(parseDurationHours('2')).toBe(2);
    expect(parseDurationHours('2.5')).toBe(2.5);
    expect(parseDurationHours(' 1.5 ')).toBe(1.5);
  });

  it('accepts text like "1h 30m" and "45m"', () => {
    expect(parseDurationHours('1h 30m')).toBe(1.5);
    expect(parseDurationHours('1h30m')).toBe(1.5);
    expect(parseDurationHours('1h')).toBe(1);
    expect(parseDurationHours('45m')).toBe(0.75);
    expect(parseDurationHours('1.5h')).toBe(1.5);
  });

  it('returns null for blank or unparseable input', () => {
    expect(parseDurationHours('')).toBeNull();
    expect(parseDurationHours('   ')).toBeNull();
    expect(parseDurationHours('2:60')).toBeNull();
    expect(parseDurationHours('2,5')).toBeNull();
    expect(parseDurationHours('soon')).toBeNull();
  });
});
