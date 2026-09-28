import { useLocation } from 'react-router-dom';

// Which auth page sent the user here, so each page's back link returns to
// where they actually came from. Links between the auth pages pass it as
// router state ({ from: 'login' }); back links pass none, so going back
// never ping-pongs between two pages.
export type AuthPage = 'login' | 'signup';

export type BackLink = { to: string; label: string };

export function useCameFrom(): AuthPage | null {
  const state = useLocation().state as { from?: unknown } | null;
  return state?.from === 'login' || state?.from === 'signup' ? state.from : null;
}

export const BACK_TO_HOME: BackLink = { to: '/', label: 'Back to home' };
export const BACK_TO_SIGN_IN: BackLink = { to: '/login', label: 'Back to sign in' };
export const BACK_TO_SIGN_UP: BackLink = { to: '/signup', label: 'Back to sign up' };
