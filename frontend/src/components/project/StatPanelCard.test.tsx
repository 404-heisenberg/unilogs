import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SavedStatPanels } from './StatPanelCard';
import { deleteStatPanel, listStatPanels, updateStatPanel } from '@/lib/api';
import type { FieldDefinition, StatPanel } from '@/types';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  listStatPanels: vi.fn(),
  updateStatPanel: vi.fn(),
  deleteStatPanel: vi.fn(),
}));

const fields: FieldDefinition[] = [
  { id: 1, projectId: 1, name: 'Pages read', fieldType: 'number' },
  { id: 2, projectId: 1, name: 'Time spent', fieldType: 'duration' },
];

function makePanel(overrides: Partial<StatPanel> = {}): StatPanel {
  return {
    id: 1,
    projectId: 1,
    name: 'Pages per hour',
    expression: 'Pages read / Time spent',
    aggregation: 'sum',
    rangeDays: 30,
    position: 0,
    hidden: false,
    createdAt: '2026-10-01T00:00:00.000Z',
    value: 12,
    sampleCount: 3,
    series: [
      { date: '2026-10-01', value: 4 },
      { date: '2026-10-02', value: 8 },
    ],
    ...overrides,
  };
}

function renderSection(onEdit = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SavedStatPanels projectId="1" fields={fields} onEdit={onEdit} />
    </QueryClientProvider>,
  );
  return { onEdit };
}

describe('SavedStatPanels', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows the value, range and sample count for a panel with data', async () => {
    vi.mocked(listStatPanels).mockResolvedValue([makePanel()]);

    renderSection();

    expect(await screen.findByText('Pages per hour')).toBeInTheDocument();
    expect(screen.getByText(/≈ 12/)).toBeInTheDocument();
    expect(screen.getByText(/Last 30 days/)).toBeInTheDocument();
    expect(screen.getByText(/3 entries/)).toBeInTheDocument();
  });

  it('shows "No data yet" instead of a misleading zero when nothing matches', async () => {
    vi.mocked(listStatPanels).mockResolvedValue([
      makePanel({ value: 0, sampleCount: 0, series: [] }),
    ]);

    renderSection();

    expect(await screen.findByText('No data yet')).toBeInTheDocument();
    expect(screen.queryByText(/≈ 0/)).not.toBeInTheDocument();
  });

  it('shows the reason when a panel could not be calculated', async () => {
    vi.mocked(listStatPanels).mockResolvedValue([
      makePanel({ value: null, sampleCount: 0, series: [], error: 'Unknown field: Mood' }),
    ]);

    renderSection();

    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown field: Mood');
  });

  it('shows an invitation to add a panel when there are none', async () => {
    vi.mocked(listStatPanels).mockResolvedValue([]);

    renderSection();

    expect(await screen.findByText(/No stat panels yet/)).toBeInTheDocument();
  });

  it('keeps hidden panels out of sight until asked', async () => {
    vi.mocked(listStatPanels).mockResolvedValue([
      makePanel({ id: 1, name: 'Visible panel' }),
      makePanel({ id: 2, name: 'Hidden panel', hidden: true }),
    ]);

    renderSection();

    expect(await screen.findByText('Visible panel')).toBeInTheDocument();
    expect(screen.queryByText('Hidden panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show 1 hidden' }));

    expect(screen.getByText('Hidden panel')).toBeInTheDocument();
  });

  it('hides a panel through the menu by saving hidden: true', async () => {
    vi.mocked(listStatPanels).mockResolvedValue([makePanel({ id: 7 })]);
    vi.mocked(updateStatPanel).mockResolvedValue(makePanel({ id: 7, hidden: true }));

    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'More actions for Pages per hour' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hide' }));

    await waitFor(() => expect(updateStatPanel).toHaveBeenCalledWith('1', 7, { hidden: true }));
  });

  it('opens the builder for the panel when Edit is chosen', async () => {
    const panel = makePanel();
    vi.mocked(listStatPanels).mockResolvedValue([panel]);

    const { onEdit } = renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'More actions for Pages per hour' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(onEdit).toHaveBeenCalledWith(panel);
  });

  it('asks before removing, then deletes the panel', async () => {
    vi.mocked(listStatPanels).mockResolvedValue([makePanel({ id: 5 })]);
    vi.mocked(deleteStatPanel).mockResolvedValue(undefined);

    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'More actions for Pages per hour' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));

    expect(screen.getByText('Remove this panel?')).toBeInTheDocument();
    expect(deleteStatPanel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(deleteStatPanel).toHaveBeenCalledWith('1', 5));
  });
});
