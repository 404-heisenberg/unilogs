import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from './time';

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
