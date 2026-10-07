import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StatPanelBuilderDialog from './StatPanelBuilderDialog';
import { ApiError, createStatPanel, previewStatPanel } from '@/lib/api';
import type { FieldDefinition, StatPanel } from '@/types';

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  previewStatPanel: vi.fn(),
  createStatPanel: vi.fn(),
  updateStatPanel: vi.fn(),
}));

const fields: FieldDefinition[] = [
  { id: 1, projectId: 1, name: 'Pages read', fieldType: 'number' },
  { id: 2, projectId: 1, name: 'Time spent', fieldType: 'duration' },
  { id: 3, projectId: 1, name: 'Mood', fieldType: 'text' },
];

function renderDialog(props: { panel?: StatPanel | null; onOpenChange?: () => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpenChange = props.onOpenChange ?? vi.fn();
  render(
    <QueryClientProvider client={client}>
      <StatPanelBuilderDialog
        open
        onOpenChange={onOpenChange}
        projectId="1"
        fields={fields}
        panel={props.panel ?? null}
      />
    </QueryClientProvider>,
  );
  return { onOpenChange };
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

const saveButton = () => screen.getByRole('button', { name: 'Save panel' });

describe('StatPanelBuilderDialog', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('offers only number and duration fields as hint chips', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: 'Pages read' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Time spent' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mood' })).not.toBeInTheDocument();
  });

  it('inserts a field into the formula when its chip is clicked', () => {
    renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Pages read' }));

    expect(screen.getByLabelText('Formula')).toHaveValue('Pages read');
  });

  it('keeps Save disabled until there is a name and a valid formula', () => {
    renderDialog();

    expect(saveButton()).toBeDisabled();
    type('Name', 'Pages per hour');
    expect(saveButton()).toBeDisabled();
  });

  it('shows a live preview value for a valid formula and enables Save', async () => {
    vi.mocked(previewStatPanel).mockResolvedValue({ value: 32, sampleCount: 18, series: [] });
    renderDialog();

    type('Name', 'Pages per hour');
    type('Formula', 'Pages read / Time spent');

    expect(await screen.findByText(/≈ 32/)).toBeInTheDocument();
    expect(screen.getByText(/18 entries/)).toBeInTheDocument();
    await waitFor(() => expect(saveButton()).toBeEnabled());
  });

  it('does not fire a request per keystroke', async () => {
    vi.mocked(previewStatPanel).mockResolvedValue({ value: 1, sampleCount: 1, series: [] });
    renderDialog();

    type('Formula', 'P');
    type('Formula', 'Pa');
    type('Formula', 'Pag');
    type('Formula', 'Pages read');

    await screen.findByText(/≈ 1/);
    expect(previewStatPanel).toHaveBeenCalledTimes(1);
    expect(previewStatPanel).toHaveBeenCalledWith('1', {
      expression: 'Pages read',
      aggregation: 'sum',
      rangeDays: 30,
    });
  });

  it('shows the server message inline for an invalid formula and keeps Save disabled', async () => {
    vi.mocked(previewStatPanel).mockRejectedValue(new ApiError(400, 'Unknown field: Moood'));
    renderDialog();

    type('Name', 'Broken');
    type('Formula', 'Moood * 2');

    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown field: Moood');
    expect(saveButton()).toBeDisabled();
  });

  it('shows "No data yet" in the preview when no entries match', async () => {
    vi.mocked(previewStatPanel).mockResolvedValue({ value: 0, sampleCount: 0, series: [] });
    renderDialog();

    type('Formula', 'Pages read');

    expect(await screen.findByText(/No data yet/)).toBeInTheDocument();
  });

  it('saves the panel with the chosen values and closes', async () => {
    vi.mocked(previewStatPanel).mockResolvedValue({ value: 32, sampleCount: 18, series: [] });
    vi.mocked(createStatPanel).mockResolvedValue({} as StatPanel);
    const { onOpenChange } = renderDialog();

    type('Name', '  Pages per hour ');
    type('Formula', 'Pages read / Time spent');
    fireEvent.click(screen.getByRole('radio', { name: 'Average' }));
    await waitFor(() => expect(saveButton()).toBeEnabled());
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(createStatPanel).toHaveBeenCalledWith('1', {
        name: 'Pages per hour',
        expression: 'Pages read / Time spent',
        aggregation: 'average',
        rangeDays: 30,
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('reopens pre-filled when editing a saved panel', () => {
    renderDialog({
      panel: {
        id: 9,
        projectId: 1,
        name: 'Total pages',
        expression: 'Pages read',
        aggregation: 'sum',
        rangeDays: 90,
        position: 0,
        hidden: false,
        createdAt: '2026-10-01T00:00:00.000Z',
        value: 40,
        sampleCount: 4,
        series: [],
      },
    });

    expect(screen.getByText('Edit stat panel')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Total pages');
    expect(screen.getByLabelText('Formula')).toHaveValue('Pages read');
    expect(screen.getByLabelText('Range')).toHaveValue('90');
  });
});
