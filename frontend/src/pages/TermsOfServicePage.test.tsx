import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TermsOfServicePage from './TermsOfServicePage';

function renderTerms() {
  return render(
    <MemoryRouter initialEntries={['/terms']}>
      <Routes>
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/privacy" element={<p>Privacy page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TermsOfServicePage', () => {
  it('renders the terms with a contents entry for every section', () => {
    renderTerms();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/your logbook/i);
    const contents = screen.getByRole('navigation', { name: /terms of service contents/i });
    expect(contents.querySelectorAll('a')).toHaveLength(10);
  });

  it('links through to the privacy policy', async () => {
    renderTerms();
    await userEvent.click(screen.getByRole('link', { name: 'Privacy Policy' }));
    expect(screen.getByText('Privacy page')).toBeInTheDocument();
  });
});
