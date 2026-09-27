import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  DEFAULT_LAYOUT,
  HEATMAP_DAYS,
  activityStats,
  addDays,
  buildHeatmap,
  heatLevel,
  heatmapRange,
  layoutKey,
  loadLayout,
  mondayOf,
  moveWidget,
  saveLayout,
  shiftWidget,
  toBlocks,
  useDashboardLayout,
  type WidgetState,
} from './dashboard';

describe('heatLevel', () => {
  it('returns 0 for empty days and scales 1 to 4 by ratio of the max', () => {
    expect(heatLevel(0, 4)).toBe(0);
    expect(heatLevel(1, 5)).toBe(1);
    expect(heatLevel(2, 5)).toBe(2);
    expect(heatLevel(3, 5)).toBe(3);
    expect(heatLevel(4, 5)).toBe(4);
    expect(heatLevel(5, 5)).toBe(4);
    expect(heatLevel(3, 0)).toBe(0);
  });
});

describe('date helpers', () => {
  it('finds the Monday of a week, including for Sundays', () => {
    expect(mondayOf('2026-09-20')).toBe('2026-09-14');
    expect(mondayOf('2026-09-14')).toBe('2026-09-14');
    expect(mondayOf('2026-09-17')).toBe('2026-09-14');
  });

  it('spans 12 whole weeks ending on the Sunday of the current week', () => {
    const { start, end } = heatmapRange('2026-09-17');
    expect(start).toBe('2026-06-29');
    expect(end).toBe('2026-09-20');
    expect(addDays(start, HEATMAP_DAYS - 1)).toBe(end);
  });
});

describe('buildHeatmap', () => {
  const today = '2026-09-17';

  it('builds 84 cells and marks days after today as future', () => {
    const cells = buildHeatmap([], 0, today);
    expect(cells).toHaveLength(84);
    expect(cells.filter((cell) => cell.future)).toHaveLength(3);
    expect(cells.every((cell) => cell.level === 0)).toBe(true);
  });

  it('forces the current streak to the top level', () => {
    const daily = [
      { date: '2026-09-15', count: 1 },
      { date: '2026-09-16', count: 1 },
      { date: '2026-09-17', count: 1 },
      { date: '2026-09-01', count: 5 },
    ];
    const cells = buildHeatmap(daily, 3, today);
    const byDate = new Map(cells.map((cell) => [cell.date, cell]));
    expect(byDate.get('2026-09-15')?.level).toBe(4);
    expect(byDate.get('2026-09-17')?.level).toBe(4);
    expect(byDate.get('2026-09-01')?.level).toBe(4);
    expect(byDate.get('2026-09-14')?.level).toBe(0);
  });

  it('ends the streak at yesterday when today has no entry', () => {
    const daily = [
      { date: '2026-09-15', count: 1 },
      { date: '2026-09-16', count: 4 },
      { date: '2026-09-10', count: 4 },
    ];
    const cells = buildHeatmap(daily, 2, today);
    const byDate = new Map(cells.map((cell) => [cell.date, cell]));
    expect(byDate.get('2026-09-15')?.level).toBe(4);
    expect(byDate.get('2026-09-16')?.level).toBe(4);
    expect(byDate.get('2026-09-10')?.level).toBe(4);
    expect(byDate.get('2026-09-17')?.level).toBe(0);
  });
});

describe('activityStats', () => {
  it('counts active days, days this week and the weekly average', () => {
    const daily = Array.from({ length: 24 }, (_, index) => ({
      date: addDays('2026-06-29', index * 3),
      count: 1,
    }));
    const cells = buildHeatmap(daily, 0, '2026-09-20');
    const stats = activityStats(cells);
    expect(stats.activeDays).toBe(24);
    expect(stats.avgDaysPerWeek).toBe(2);
    expect(stats.daysThisWeek).toBe(cells.slice(-7).filter((cell) => cell.count > 0).length);
  });
});

describe('loadLayout', () => {
  it('returns the default layout when nothing is saved or there is no user', () => {
    expect(loadLayout('u1')).toBe(DEFAULT_LAYOUT);
    expect(loadLayout(null)).toBe(DEFAULT_LAYOUT);
  });

  it('keeps saved order, visibility and size per user', () => {
    const custom: WidgetState[] = [
      { id: 'recent', visible: true, size: 'wide' },
      { id: 'summary', visible: false, size: 'wide' },
    ];
    localStorage.setItem(layoutKey('u1'), JSON.stringify(custom));

    const loaded = loadLayout('u1');
    expect(loaded[0]).toEqual({ id: 'recent', visible: true, size: 'wide' });
    expect(loaded[1]).toEqual({ id: 'summary', visible: false, size: 'wide' });
    expect(loadLayout('u2')).toBe(DEFAULT_LAYOUT);
  });

  it('appends widgets that were added after the layout was saved', () => {
    localStorage.setItem(
      layoutKey('u1'),
      JSON.stringify([{ id: 'summary', visible: true, size: 'wide' }]),
    );
    const loaded = loadLayout('u1');
    expect(loaded).toHaveLength(DEFAULT_LAYOUT.length);
    expect(loaded.map((widget) => widget.id)).toContain('dueDormant');
  });

  it('ignores corrupt data, unknown widgets and duplicates', () => {
    localStorage.setItem(layoutKey('u1'), '{not json');
    expect(loadLayout('u1')).toBe(DEFAULT_LAYOUT);

    localStorage.setItem(
      layoutKey('u1'),
      JSON.stringify([
        { id: 'nope', visible: true, size: 'wide' },
        { id: 'summary', visible: true, size: 'huge' },
        { id: 'recent', visible: false, size: 'standard' },
        { id: 'recent', visible: true, size: 'wide' },
      ]),
    );
    const loaded = loadLayout('u1');
    expect(loaded.filter((widget) => widget.id === 'recent')).toEqual([
      { id: 'recent', visible: false, size: 'standard' },
    ]);
    expect(loaded).toHaveLength(DEFAULT_LAYOUT.length);
  });
});

describe('saveLayout', () => {
  it('clears storage when the layout is the default', () => {
    saveLayout('u1', [{ id: 'summary', visible: true, size: 'wide' }]);
    expect(localStorage.getItem(layoutKey('u1'))).not.toBeNull();
    saveLayout('u1', DEFAULT_LAYOUT);
    expect(localStorage.getItem(layoutKey('u1'))).toBeNull();
  });
});

describe('moveWidget and shiftWidget', () => {
  it('moves a widget onto another widget position', () => {
    const moved = moveWidget(DEFAULT_LAYOUT, 'insight', 'summary');
    expect(moved[0].id).toBe('insight');
    expect(moved).toHaveLength(DEFAULT_LAYOUT.length);
  });

  it('shifts by one place among visible widgets only', () => {
    const shifted = shiftWidget(DEFAULT_LAYOUT, 'insight', -1);
    const ids = shifted.map((widget) => widget.id);
    expect(ids.indexOf('insight')).toBeLessThan(ids.indexOf('recent'));
  });

  it('does nothing at the ends of the list', () => {
    expect(shiftWidget(DEFAULT_LAYOUT, 'summary', -1)).toBe(DEFAULT_LAYOUT);
  });
});

describe('toBlocks', () => {
  const visible = DEFAULT_LAYOUT.filter((widget) => widget.visible);

  it('keeps wide widgets as rows and alternates standard widgets into two columns', () => {
    const blocks = toBlocks(visible, true);
    expect(blocks.map((block) => block.kind)).toEqual(['row', 'row', 'columns']);
    const columns = blocks[2];
    if (columns.kind !== 'columns') throw new Error('expected columns');
    expect(columns.left.map((widget) => widget.id)).toEqual(['whatsLeft', 'recent', 'upcoming']);
    expect(columns.right.map((widget) => widget.id)).toEqual(['continue', 'insight']);
  });

  it('renders a single column in widget order on small screens', () => {
    const blocks = toBlocks(visible, false);
    expect(blocks.every((block) => block.kind === 'row')).toBe(true);
    expect(blocks).toHaveLength(visible.length);
  });
});

describe('useDashboardLayout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts from the default layout with only the extra tray widgets hidden', () => {
    const { result } = renderHook(() => useDashboardLayout('u1'));
    expect(result.current.layout).toBe(DEFAULT_LAYOUT);
    expect(result.current.visible.map((widget) => widget.id)).toEqual([
      'summary',
      'heatmap',
      'whatsLeft',
      'continue',
      'recent',
      'insight',
      'upcoming',
    ]);
    expect(result.current.hidden.map((widget) => widget.id)).toEqual([
      'timeByProject',
      'frequency',
      'dueDormant',
    ]);
  });

  it('writes to localStorage on a 300ms trailing debounce', () => {
    const { result } = renderHook(() => useDashboardLayout('u1'));

    act(() => result.current.toggle('recent'));
    act(() => result.current.resize('insight'));
    act(() => vi.advanceTimersByTime(299));
    expect(localStorage.getItem(layoutKey('u1'))).toBeNull();

    act(() => vi.advanceTimersByTime(1));
    const saved = JSON.parse(localStorage.getItem(layoutKey('u1')) ?? '[]');
    expect(saved.find((widget: { id: string }) => widget.id === 'recent').visible).toBe(false);
    expect(saved.find((widget: { id: string }) => widget.id === 'insight').size).toBe('wide');
  });

  it('resets to the default layout and clears the saved one', () => {
    const { result } = renderHook(() => useDashboardLayout('u1'));
    act(() => result.current.toggle('recent'));
    act(() => vi.advanceTimersByTime(300));
    expect(localStorage.getItem(layoutKey('u1'))).not.toBeNull();

    act(() => result.current.reset());
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.layout).toBe(DEFAULT_LAYOUT);
    expect(localStorage.getItem(layoutKey('u1'))).toBeNull();
  });

  it('never saves without a user and loads the right layout when the user arrives', () => {
    localStorage.setItem(
      layoutKey('u2'),
      JSON.stringify([{ id: 'insight', visible: true, size: 'wide' }]),
    );
    const { result, rerender } = renderHook(({ id }) => useDashboardLayout(id), {
      initialProps: { id: null as string | null },
    });

    act(() => result.current.toggle('recent'));
    act(() => vi.advanceTimersByTime(500));
    expect(localStorage.length).toBe(1);

    rerender({ id: 'u2' });
    expect(result.current.layout[0]).toEqual({ id: 'insight', visible: true, size: 'wide' });
  });

  it('reorders by id and by keyboard-style shifts', () => {
    const { result } = renderHook(() => useDashboardLayout('u1'));
    act(() => result.current.move('insight', 'summary'));
    expect(result.current.visible[0].id).toBe('insight');

    act(() => result.current.moveBy('insight', 1));
    expect(result.current.visible[1].id).toBe('insight');
  });
});
