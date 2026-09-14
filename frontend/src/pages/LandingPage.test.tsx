import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  it('links sign-in and sign-up actions to the right routes', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/signup');
    expect(screen.getByRole('link', { name: 'Start logging for free' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('link', { name: 'I have an account' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.getByRole('link', { name: 'Create your logbook' })).toHaveAttribute(
      'href',
      '/signup',
    );
  });

  it('renders the feature highlights', () => {
    renderPage();

    expect(screen.getByText('Your projects, your way')).toBeInTheDocument();
    expect(screen.getByText('Three seconds, not three excuses')).toBeInTheDocument();
    expect(screen.getByText('Everywhere you are')).toBeInTheDocument();
  });
});
