import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import SuggestionsPage from './SuggestionsPage';
import { ApiError } from '@/lib/api';

const { getMock, postMock, toastError } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { ...actual.api, get: getMock, post: postMock } };
});

vi.mock('@/lib/toast', () => ({
  toast: { error: toastError, success: vi.fn(), info: vi.fn() },
}));

const SUGGESTIONS = [
  { id: 'evt-1', title: 'Supervisor meeting', start: '2026-09-29T09:00:00.000Z' },
  { id: 'evt-2', title: 'Reading day', start: '2026-09-30' },
];

const FIELDS = [
  { id: 1, projectId: 7, name: 'Hours', fieldType: 'duration' },
  { id: 2, projectId: 7, name: 'Done', fieldType: 'boolean' },
];

type Routes = Record<string, unknown>;

function mockGet(routes: Routes) {
  getMock.mockImplementation((path: string) => {
    for (const [prefix, value] of Object.entries(routes)) {
      if (path.startsWith(prefix)) {
        return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
      }
    }
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

const CONNECTED: Routes = {
  '/api/calendar/status': { connected: true },
  '/api/calendar/events/suggestions': { connected: true, suggestions: SUGGESTIONS },
  '/api/projects': [{ id: 7, name: 'Thesis', archived: false, userId: 'u1' }],
  '/api/field-definitions': FIELDS,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SuggestionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SuggestionsPage', () => {
  it('offers to connect Google Calendar when it is not connected', async () => {
    mockGet({ '/api/calendar/status': { connected: false } });
    postMock.mockResolvedValue({ connected: true });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Connect Google Calendar' }));
    expect(postMock).toHaveBeenCalledWith('/api/calendar/connect');
  });

  it('offers a Reconnect action when the connection has expired', async () => {
    mockGet({ '/api/calendar/status': { connected: true, needsReauth: true } });
    postMock.mockResolvedValue({ connected: true });

    renderPage();

    expect(
      await screen.findByRole('button', { name: 'Reconnect Google Calendar' }),
    ).toBeInTheDocument();
    // The suggestions list is not fetched and the empty state is not shown.
    expect(getMock).not.toHaveBeenCalledWith(expect.stringContaining('/events/suggestions'));
    expect(screen.queryByText(/No upcoming events to suggest/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reconnect Google Calendar' }));
    expect(postMock).toHaveBeenCalledWith('/api/calendar/connect');
  });

  it('lets the user retry when the connection check fails', async () => {
    mockGet({ '/api/calendar/status': new Error('offline') });

    renderPage();

    expect(
      await screen.findByText("Couldn't check the Google Calendar connection."),
    ).toBeInTheDocument();
    mockGet({ '/api/calendar/status': { connected: false } });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('button', { name: 'Connect Google Calendar' }),
    ).toBeInTheDocument();
  });

  it('shows an empty state when there are no events to suggest', async () => {
    mockGet({
      '/api/calendar/status': { connected: true },
      '/api/calendar/events/suggestions': { connected: true, suggestions: [] },
    });

    renderPage();

    expect(await screen.findByText(/No upcoming events to suggest/)).toBeInTheDocument();
  });

  it('lets the user retry when suggestions fail to load', async () => {
    mockGet({
      '/api/calendar/status': { connected: true },
      '/api/calendar/events/suggestions': new Error('boom'),
    });

    renderPage();

    expect(await screen.findByText("Couldn't load calendar suggestions.")).toBeInTheDocument();
    mockGet(CONNECTED);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Supervisor meeting')).toBeInTheDocument();
  });

  it('lists suggestions and rejects one', async () => {
    mockGet(CONNECTED);
    postMock.mockResolvedValue({ message: 'ok' });

    renderPage();

    expect(await screen.findByText('Supervisor meeting')).toBeInTheDocument();
    expect(screen.getByText('Reading day')).toBeInTheDocument();
    // All-day events show their date as-is.
    expect(screen.getByText('2026-09-30')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Reject' })[0]);
    expect(postMock).toHaveBeenCalledWith('/api/calendar/events/suggestions/evt-1/reject');
  });

  it('shows a toast when rejecting fails', async () => {
    mockGet(CONNECTED);
    postMock.mockRejectedValue(new Error('Could not reject'));

    renderPage();

    await userEvent.click((await screen.findAllByRole('button', { name: 'Reject' }))[0]);
    await waitFor(() => expect(toastError).toHaveBeenCalled());
  });

  it('logs an accepted suggestion as an entry in the chosen project', async () => {
    mockGet(CONNECTED);
    postMock.mockResolvedValue({ id: 42 });

    renderPage();

    await userEvent.click((await screen.findAllByRole('button', { name: 'Accept' }))[0]);
    expect(screen.getByLabelText('Date')).toHaveValue('2026-09-29');

    await userEvent.selectOptions(screen.getByLabelText('Project'), '7');
    const hours = await screen.findByLabelText('Hours');

    // Required non-boolean fields are validated before anything is sent.
    await userEvent.click(screen.getByRole('button', { name: 'Log entry' }));
    expect(await screen.findByText('Hours is required')).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();

    await userEvent.type(hours, '1.5');
    await userEvent.click(screen.getByLabelText('Done'));
    await userEvent.click(screen.getByRole('button', { name: 'Log entry' }));

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith('/api/calendar/events/suggestions/evt-1/accept', {
        projectId: 7,
        date: '2026-09-29',
        content: expect.objectContaining({ Done: true }),
      }),
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Log entry' })).toBeNull());
  });

  it('maps field errors from the server onto their inputs and toasts the rest', async () => {
    mockGet(CONNECTED);
    postMock.mockRejectedValue(
      new ApiError(400, 'Validation failed', {
        errors: ["Field 'Hours' must be a number", 'Event already logged'],
      }),
    );

    renderPage();

    await userEvent.click((await screen.findAllByRole('button', { name: 'Accept' }))[0]);
    await userEvent.selectOptions(screen.getByLabelText('Project'), '7');
    await userEvent.type(await screen.findByLabelText('Hours'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Log entry' }));

    expect(await screen.findByText("Field 'Hours' must be a number")).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith('Event already logged');
  });

  it('says so when the chosen project has no fields, and closes on cancel', async () => {
    mockGet({ ...CONNECTED, '/api/field-definitions': [] });

    renderPage();

    await userEvent.click((await screen.findAllByRole('button', { name: 'Accept' }))[1]);
    await userEvent.selectOptions(screen.getByLabelText('Project'), '7');
    expect(
      await screen.findByText('This project has no fields — no extra values needed.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Project')).toBeNull();
  });
});
