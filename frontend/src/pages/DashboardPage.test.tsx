import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';

const { getStatsSummaryMock, getFrequencyStatsMock } = vi.hoisted(() => ({
  getStatsSummaryMock: vi.fn(),
  getFrequencyStatsMock: vi.fn(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    getStatsSummary: getStatsSummaryMock,
    getFrequencyStats: getFrequencyStatsMock,
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DashboardPage', () => {
  it('shows an empty state when there are no entries yet', async () => {
    getStatsSummaryMock.mockResolvedValue({ perProject: [], totalHours: 0, streak: 0 });
    getFrequencyStatsMock.mockResolvedValue({ weekly: [], terms: [] });

    renderPage();

    expect(await screen.findByText('No entries yet')).toBeInTheDocument();
  });

  it('renders stats once entries exist', async () => {
    getStatsSummaryMock.mockResolvedValue({
      perProject: [{ projectId: 1, projectName: 'Thesis', totalHours: 12 }],
      totalHours: 12,
      streak: 3,
    });
    getFrequencyStatsMock.mockResolvedValue({
      weekly: [{ weekStart: '2026-09-01', count: 2 }],
      terms: [],
    });

    renderPage();

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Total logged')).toBeInTheDocument();
    expect(screen.getByText('Top project')).toBeInTheDocument();
    expect(screen.getByText('Thesis')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Week of 2026-09-01: 2 entries' }),
    ).toBeInTheDocument();
  });

  it("shows an error state when the stats can't be loaded", async () => {
    getStatsSummaryMock.mockRejectedValue(new Error('network error'));
    getFrequencyStatsMock.mockResolvedValue({ weekly: [], terms: [] });

    renderPage();

    expect(await screen.findByText("Couldn't load your stats")).toBeInTheDocument();
  });
});
