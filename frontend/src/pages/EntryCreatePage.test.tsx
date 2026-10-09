import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import EntryCreatePage from './EntryCreatePage';

const { getMock, postMock, toastMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { get: getMock, post: postMock } };
});

// Sonner renders nothing without its <Toaster/>, so the queued/refused copy is
// only observable by spying on the wrapper.
vi.mock('@/lib/toast', () => ({ toast: toastMock }));

const LAST_PROJECT_KEY = 'unilogs:last-project-id';

const PROJECTS = [{ id: 1, name: 'Gym', description: null, userId: 'u1' }];

// One field per supported type, so every branch of the dynamic form renders.
const FIELDS = [
  { id: 1, projectId: 1, name: 'Notes', fieldType: 'text' },
  { id: 2, projectId: 1, name: 'Reps', fieldType: 'number' },
  { id: 3, projectId: 1, name: 'Day', fieldType: 'date' },
  { id: 4, projectId: 1, name: 'Length', fieldType: 'duration' },
  { id: 5, projectId: 1, name: 'Warmup', fieldType: 'boolean' },
];

function renderPage(path = '/entries/new') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/entries/new', element: <EntryCreatePage /> },
      { path: '/entries/:id', element: <EntryCreatePage /> },
      { path: '*', element: <div /> },
    ],
    { initialEntries: [path] },
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

async function fillAllFields() {
  fireEvent.change(await screen.findByLabelText('Notes'), { target: { value: 'Chest day' } });
  fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-09-10' } });
  fireEvent.change(screen.getByLabelText('Length'), { target: { value: '45' } });
  await userEvent.click(screen.getByRole('switch', { name: 'Warmup' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem(LAST_PROJECT_KEY, '1');
  getMock.mockImplementation((path: string) => {
    if (path === '/api/projects') return Promise.resolve(PROJECTS);
    if (path.startsWith('/api/field-definitions')) return Promise.resolve(FIELDS);
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe('EntryCreatePage dynamic form', () => {
  it('renders an input matched to each field type', async () => {
    renderPage();

    expect(await screen.findByLabelText('Notes')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Reps')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('Day')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Length')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('Length')).toHaveAttribute('placeholder', 'Hours, e.g. 1.5');
    expect(screen.getByRole('switch', { name: 'Warmup' })).toBeInTheDocument();
  });

  it('submits a content payload with one value per field, typed by field type', async () => {
    postMock.mockResolvedValue({ id: 99 });
    renderPage();

    await fillAllFields();
    await userEvent.click(screen.getByRole('button', { name: /save entry/i }));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    expect(postMock).toHaveBeenCalledWith('/api/entries', {
      projectId: 1,
      date: expect.any(String),
      content: {
        Notes: 'Chest day',
        Reps: 12,
        Day: '2026-09-10',
        Length: 45,
        Warmup: true,
      },
    });
  });

  it('surfaces a backend field error on the matching input', async () => {
    postMock.mockRejectedValue(
      new ApiError(400, 'Validation failed', {
        errors: ["Field 'Reps' must be a number"],
      }),
    );
    renderPage();

    await fillAllFields();
    await userEvent.click(screen.getByRole('button', { name: /save entry/i }));

    expect(await screen.findByText("Field 'Reps' must be a number")).toBeInTheDocument();
    expect(screen.getByLabelText('Reps')).toHaveClass('border-error');
  });

  it('does not call the API when a required field is left empty', async () => {
    renderPage();

    // Everything except Reps.
    fireEvent.change(await screen.findByLabelText('Notes'), { target: { value: 'Chest day' } });
    fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-09-10' } });
    fireEvent.change(screen.getByLabelText('Length'), { target: { value: '45' } });

    await userEvent.click(screen.getByRole('button', { name: /save entry/i }));

    expect(await screen.findByText('Reps is required')).toBeInTheDocument();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('keeps submit disabled until a project with fields is chosen', async () => {
    localStorage.removeItem(LAST_PROJECT_KEY);
    renderPage();

    await waitFor(() => expect(getMock).toHaveBeenCalledWith('/api/projects'));
    expect(screen.getByRole('button', { name: /save entry/i })).toBeDisabled();
  });
});

const QUEUE_KEY = 'unilogs:offline-queue';

function queuedEntries(): {
  clientId: string;
  projectId: number;
  content: Record<string, unknown>;
}[] {
  const raw = localStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

describe('EntryCreatePage offline capture', () => {
  afterEach(() => vi.restoreAllMocks());

  it('queues the save instead of posting it, and says so', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderPage();

    await fillAllFields();
    await userEvent.click(screen.getByRole('button', { name: /save entry/i }));

    expect(
      await screen.findByText(/you're offline — entries will sync when you reconnect/i),
    ).toBeInTheDocument();
    expect(screen.getByText('1 entry queued')).toBeInTheDocument();
    expect(toastMock.info).toHaveBeenCalledWith('Saved offline — will sync later.');
    // Still on the editor, cleared for the next capture.
    expect(screen.getByLabelText('Title')).toHaveValue('');

    expect(postMock).not.toHaveBeenCalled();
    expect(queuedEntries()).toHaveLength(1);
    expect(queuedEntries()[0]).toMatchObject({ projectId: 1, content: { Notes: 'Chest day' } });

    onLine.mockRestore();
  });

  it('falls back to the queue when the save fails as a network error', async () => {
    postMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderPage();

    await fillAllFields();
    await userEvent.click(screen.getByRole('button', { name: /save entry/i }));

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(queuedEntries()).toHaveLength(1));
    expect(screen.getByText('1 entry queued')).toBeInTheDocument();
  });

  it('still reports a backend rejection instead of queueing it', async () => {
    postMock.mockRejectedValue(
      new ApiError(400, 'Validation failed', { errors: ["Field 'Reps' must be a number"] }),
    );
    renderPage();

    await fillAllFields();
    await userEvent.click(screen.getByRole('button', { name: /save entry/i }));

    expect(await screen.findByText("Field 'Reps' must be a number")).toBeInTheDocument();
    expect(queuedEntries()).toHaveLength(0);
  });

  it('refuses to queue an edit, because the sync endpoint only creates', async () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const ENTRY = {
      id: 7,
      projectId: 1,
      date: '2026-09-10T00:00:00.000Z',
      createdAt: '2026-09-10T00:00:00.000Z',
      content: { Notes: 'Chest day', Reps: 12, Day: '2026-09-10', Length: 45, Warmup: true },
      title: null,
      body: null,
      tags: [],
    };
    getMock.mockImplementation((path: string) => {
      if (path === '/api/projects') return Promise.resolve(PROJECTS);
      if (path.startsWith('/api/field-definitions')) return Promise.resolve(FIELDS);
      if (path === '/api/entries/7') return Promise.resolve(ENTRY);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });

    renderPage('/entries/7');

    // The save button only renders on an edit once something has changed.
    fireEvent.change(await screen.findByLabelText('Notes'), { target: { value: 'Leg day' } });
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    // Nothing queued - a replayed edit would come back as a second entry.
    expect(queuedEntries()).toHaveLength(0);
    expect(toastMock.error).toHaveBeenCalledWith(
      expect.stringMatching(/offline/i),
      expect.objectContaining({ description: expect.stringMatching(/still here/i) }),
    );
    // The edit is still on screen for when they reconnect.
    expect(screen.getByLabelText('Notes')).toHaveValue('Leg day');

    onLine.mockRestore();
  });
});
