import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NotFoundPage from './NotFoundPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('NotFoundPage', () => {
  it('catches an unknown URL', () => {
    renderAt('/projectz');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/isn.t in the logbook/i);
  });

  it('links back home', async () => {
    renderAt('/projectz');
    await userEvent.click(screen.getByRole('link', { name: 'Back to home' }));
    expect(screen.getByText('Home page')).toBeInTheDocument();
  });
});
