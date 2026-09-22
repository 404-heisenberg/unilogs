import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstallPrompt from './InstallPrompt';

function fireBeforeInstallPrompt(prompt = vi.fn().mockResolvedValue(undefined)) {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = prompt;
  event.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('InstallPrompt', () => {
  it('renders nothing until the browser signals installability', () => {
    const { container } = render(<InstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the banner once beforeinstallprompt fires, and triggers the native prompt', async () => {
    render(<InstallPrompt />);
    const prompt = vi.fn().mockResolvedValue(undefined);
    fireBeforeInstallPrompt(prompt);

    expect(await screen.findByText('Install UniLogs')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(prompt).toHaveBeenCalled();
  });

  it('dismisses and remembers the dismissal across remounts', async () => {
    const { unmount } = render(<InstallPrompt />);
    fireBeforeInstallPrompt();
    await screen.findByText('Install UniLogs');

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss install prompt' }));
    expect(screen.queryByText('Install UniLogs')).not.toBeInTheDocument();
    unmount();

    render(<InstallPrompt />);
    fireBeforeInstallPrompt();
    expect(screen.queryByText('Install UniLogs')).not.toBeInTheDocument();
  });
});
