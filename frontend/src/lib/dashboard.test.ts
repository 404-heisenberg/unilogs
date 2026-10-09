import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
  normalizeLayout,
  saveLayout,
  shiftWidget,
  toBlocks,
  useDashboardLayout,
  type WidgetState,
} from './dashboard';

const layoutApi = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getDashboardLayout: layoutApi.get,
  putDashboardLayout: layoutApi.put,
}));

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
    expect(ids.indexOf('insight')).toBeLessThan(ids.indexOf('upcoming'));
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
    expect(columns.left.map((widget) => widget.id)).toEqual(['whatsLeft', 'continue', 'insight']);
    expect(columns.right.map((widget) => widget.id)).toEqual(['recent', 'upcoming']);
  });

  it('renders a single column in widget order on small screens', () => {
    const blocks = toBlocks(visible, false);
    expect(blocks.every((block) => block.kind === 'row')).toBe(true);
    expect(blocks).toHaveLength(visible.length);
  });
});

describe('normalizeLayout', () => {
  it('keeps saved panel widgets alongside the built-ins', () => {
    const layout = normalizeLayout([
      { id: 'statPanel:7', visible: true, size: 'wide' },
      { id: 'statPanel:x', visible: true, size: 'wide' },
      { id: 'summary', visible: false, size: 'wide' },
    ]);

    expect(layout[0]).toEqual({ id: 'statPanel:7', visible: true, size: 'wide' });
    expect(layout[1]).toEqual({ id: 'summary', visible: false, size: 'wide' });
    expect(layout).toHaveLength(DEFAULT_LAYOUT.length + 1);
  });

  it('falls back to the default for anything that is not a list', () => {
    expect(normalizeLayout(null)).toBe(DEFAULT_LAYOUT);
    expect(normalizeLayout({ summary: true })).toBe(DEFAULT_LAYOUT);
  });
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client }, children);
}

// Lets the layout query settle under fake timers.
const settle = () => act(() => vi.advanceTimersByTimeAsync(0));

describe('useDashboardLayout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    layoutApi.get.mockReset().mockResolvedValue({ layout: null });
    layoutApi.put.mockReset().mockImplementation(async (layout: unknown) => ({ layout }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts from the default layout with only the extra tray widgets hidden', () => {
    const { result } = renderHook(() => useDashboardLayout('u1'), { wrapper });
    expect(result.current.layout).toBe(DEFAULT_LAYOUT);
    expect(result.current.visible.map((widget) => widget.id)).toEqual([
      'summary',
      'heatmap',
      'whatsLeft',
      'recent',
      'continue',
      'upcoming',
      'insight',
    ]);
    expect(result.current.hidden.map((widget) => widget.id)).toEqual([
      'timeByProject',
      'frequency',
      'dueDormant',
    ]);
  });

  it('writes to localStorage on a 300ms trailing debounce', () => {
    const { result } = renderHook(() => useDashboardLayout('u1'), { wrapper });

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
    const { result } = renderHook(() => useDashboardLayout('u1'), { wrapper });
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
      wrapper,
    });

    act(() => result.current.toggle('recent'));
    act(() => vi.advanceTimersByTime(500));
    expect(localStorage.length).toBe(1);

    rerender({ id: 'u2' });
    expect(result.current.layout[0]).toEqual({ id: 'insight', visible: true, size: 'wide' });
  });

  it('reorders by id and by keyboard-style shifts', () => {
    const { result } = renderHook(() => useDashboardLayout('u1'), { wrapper });
    act(() => result.current.move('insight', 'summary'));
    expect(result.current.visible[0].id).toBe('insight');

    act(() => result.current.moveBy('insight', 1));
    expect(result.current.visible[1].id).toBe('insight');
  });

  it('takes the server layout over the copy in this browser', async () => {
    localStorage.setItem(
      layoutKey('u1'),
      JSON.stringify([{ id: 'insight', visible: true, size: 'wide' }]),
    );
    layoutApi.get.mockResolvedValue({
      layout: [{ id: 'recent', visible: true, size: 'wide' }],
    });

    const { result } = renderHook(() => useDashboardLayout('u1'), { wrapper });
    await settle();

    expect(result.current.layout[0]).toEqual({ id: 'recent', visible: true, size: 'wide' });
    act(() => vi.advanceTimersByTime(1000));
    expect(layoutApi.put).not.toHaveBeenCalled();
  });

  it('promotes the browser copy once when the server has none', async () => {
    const custom = [{ id: 'insight', visible: true, size: 'wide' }];
    localStorage.setItem(layoutKey('u1'), JSON.stringify(custom));

    const { result } = renderHook(() => useDashboardLayout('u1'), { wrapper });
    await settle();
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(layoutApi.put).toHaveBeenCalledTimes(1);
    expect(layoutApi.put.mock.calls[0][0][0]).toEqual(custom[0]);
    // Nothing lost: the promoted layout is the one on screen.
    expect(result.current.layout[0]).toEqual(custom[0]);
  });

  it('sends nothing when neither the server nor the browser has a layout', async () => {
    renderHook(() => useDashboardLayout('u1'), { wrapper });
    await settle();
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(layoutApi.put).not.toHaveBeenCalled();
  });

  it('sends one PUT per burst of changes, 300ms after the last', async () => {
    const { result } = renderHook(() => useDashboardLayout('u1'), { wrapper });
    await settle();

    act(() => result.current.toggle('recent'));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.resize('insight'));
    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(layoutApi.put).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(layoutApi.put).toHaveBeenCalledTimes(1);
    const sent = layoutApi.put.mock.calls[0][0] as WidgetState[];
    expect(sent.find((widget) => widget.id === 'recent')?.visible).toBe(false);
    expect(sent.find((widget) => widget.id === 'insight')?.size).toBe('wide');
  });

  it('keeps working from the browser copy when the server is unreachable', async () => {
    layoutApi.get.mockRejectedValue(new Error('offline'));
    layoutApi.put.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useDashboardLayout('u1'), { wrapper });
    await settle();

    act(() => result.current.toggle('recent'));
    await act(() => vi.advanceTimersByTimeAsync(300));

    const saved = JSON.parse(localStorage.getItem(layoutKey('u1')) ?? '[]');
    expect(saved.find((widget: { id: string }) => widget.id === 'recent').visible).toBe(false);
  });

  it('adds a panel at the end, and brings a hidden one back where it was', async () => {
    const { result } = renderHook(() => useDashboardLayout('u1', new Set([7, 9])), { wrapper });
    await settle();

    act(() => result.current.addPanel(7));
    expect(result.current.visible.at(-1)).toEqual({
      id: 'statPanel:7',
      visible: true,
      size: 'standard',
    });

    act(() => result.current.resize('statPanel:7'));
    act(() => result.current.move('statPanel:7', 'summary'));
    act(() => result.current.toggle('statPanel:7'));
    expect(result.current.visible.some((widget) => widget.id === 'statPanel:7')).toBe(false);
    // Panels live in the tray's own "Your panels" entry, not with the built-ins.
    expect(result.current.hidden.some((widget) => widget.id === 'statPanel:7')).toBe(false);

    act(() => result.current.addPanel(7));
    expect(result.current.visible[0]).toEqual({ id: 'statPanel:7', visible: true, size: 'wide' });
  });

  it('does not draw a panel widget whose panel has been deleted', async () => {
    layoutApi.get.mockResolvedValue({
      layout: [
        { id: 'statPanel:7', visible: true, size: 'standard' },
        { id: 'statPanel:8', visible: true, size: 'standard' },
      ],
    });
    const { result } = renderHook(() => useDashboardLayout('u1', new Set([7])), { wrapper });
    await settle();

    const ids = result.current.visible.map((widget) => widget.id);
    expect(ids).toContain('statPanel:7');
    expect(ids).not.toContain('statPanel:8');
  });
});
