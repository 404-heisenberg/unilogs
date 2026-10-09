import '@testing-library/jest-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SharedReportPage from './SharedReportPage';
import type { SharedReport } from '@/lib/sharedReport';

const today = new Date().toISOString().slice(0, 10);

const REPORT: SharedReport = {
  project: { id: 1, name: 'Thesis', description: 'Final year research' },
  includeBodies: true,
  rangeDays: 30,
  dateFrom: '2026-08-29T00:00:00.000Z',
  dateTo: '2026-09-28T12:00:00.000Z',
  fields: [{ name: 'Hours', fieldType: 'duration' }],
  summary: {
    entryCount: 1,
    trackedTimeMinutes: 90,
    lastLoggedAt: `${today}T00:00:00.000Z`,
    entriesThisWeek: 1,
  },
  insights: [{ name: 'Hours', fieldType: 'duration', valueMinutes: 90, sampleCount: 1 }],
  entries: [
    {
      id: 1,
      date: `${today}T00:00:00.000Z`,
      title: 'Literature review',
      content: { Hours: 1.5 },
      tags: ['research'],
      body: '## Read the related-work papers',
    },
  ],
};

function mockFetch(response: Partial<Response>) {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, ...response });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPage(token = 'abc123') {
  return render(
    <MemoryRouter initialEntries={[`/share/${token}`]}>
      <Routes>
        <Route path="/share/:token" element={<SharedReportPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SharedReportPage', () => {
  it('renders the project summary, insights and entries', async () => {
    const fetchMock = mockFetch({ json: () => Promise.resolve(REPORT) });

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Thesis' })).toBeInTheDocument();
    // VITE_API_URL may prefix these URLs depending on the local .env.
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/share\/abc123$/),
      expect.anything(),
    );
    expect(screen.getByText('Final year research')).toBeInTheDocument();
    expect(screen.getByText('Literature review')).toBeInTheDocument();
    expect(screen.getByText('Read the related-work papers')).toBeInTheDocument();
    expect(screen.getByText('research')).toBeInTheDocument();
    expect(screen.getByText('1h 30m hours')).toBeInTheDocument();
    expect(screen.getAllByText('1h 30m').length).toBeGreaterThan(0);
    expect(
      screen.getByText("This report includes every entry's notes (bodies)."),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Download CSV/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/\/share\/abc123\/export\?format=csv$/),
    );
    await waitFor(() => expect(document.title).toBe('Thesis — UniLogs report'));
  });

  it('tells the viewer when entry notes were left out', async () => {
    mockFetch({
      json: () => Promise.resolve({ ...REPORT, includeBodies: false, entries: [] }),
    });

    renderPage();

    expect(await screen.findByText(/Entry notes \(bodies\) aren't included/)).toBeInTheDocument();
  });

  it('explains when the link has been revoked or expired', async () => {
    mockFetch({ ok: false, status: 404 });

    renderPage();

    expect(await screen.findByText('This link isn’t available')).toBeInTheDocument();
  });

  it('asks the viewer to wait when rate limited', async () => {
    mockFetch({ ok: false, status: 429 });

    renderPage();

    expect(
      await screen.findByText('Too many requests. Try again in a moment.'),
    ).toBeInTheDocument();
  });

  it('shows a generic error when the request fails', async () => {
    mockFetch({ ok: false, status: 500 });

    renderPage();

    expect(
      await screen.findByText('Couldn’t load this report. Try again later.'),
    ).toBeInTheDocument();
  });
});
