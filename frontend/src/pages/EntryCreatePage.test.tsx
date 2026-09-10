import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '@/lib/api';
import EntryCreatePage from './EntryCreatePage';

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, api: { get: getMock, post: postMock } };
});

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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <EntryCreatePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function fillAllFields() {
  fireEvent.change(await screen.findByLabelText('Notes'), { target: { value: 'Chest day' } });
  fireEvent.change(screen.getByLabelText('Reps'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: '2026-09-10' } });
  fireEvent.change(screen.getByLabelText('Length'), { target: { value: '45' } });
  await userEvent.click(screen.getByLabelText('Warmup'));
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
    expect(screen.getByLabelText('Length')).toHaveAttribute('placeholder', 'minutes');
    expect(screen.getByLabelText('Warmup')).toHaveAttribute('type', 'checkbox');
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
    expect(screen.getByLabelText('Reps')).toHaveClass('border-red-500');
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
