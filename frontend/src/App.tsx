import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';

// The landing page is the only route bundled up front: it's where most
// visitors arrive. Every other page, and the signed-in app shell, is split
// into its own chunk and downloaded when it's first visited, so a visitor
// never pays for the editor, dashboard or Markdown renderer before signing in.
const AppShell = lazy(() => import('./components/AppShell'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProjectCreatePage = lazy(() => import('./pages/ProjectCreatePage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const EntriesPage = lazy(() => import('./pages/EntriesPage'));
const EntriesAsAtPage = lazy(() => import('./pages/EntriesAsAtPage'));
const EntryCreatePage = lazy(() => import('./pages/EntryCreatePage'));
const EntryDetailPage = lazy(() => import('./pages/EntryDetailPage'));
const EntryHistoryPage = lazy(() => import('./pages/EntryHistoryPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SuggestionsPage = lazy(() => import('./pages/SuggestionsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
// Public share page: no app/auth code ships with it.
const SharedReportPage = lazy(() => import('./pages/SharedReportPage'));

// Full-page placeholder while a route's chunk downloads. Matches the page
// background so the swap to real content doesn't flash.
function RouteFallback() {
  return <div className="min-h-screen bg-canvas" aria-busy="true" />;
}

function page(element: ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

// This app has no theme switching (always the warm cream/gold palette), so
// the shared Toaster is styled directly here with the same hex tokens used
// everywhere else, forcing theme="light" rather than the ui/sonner.tsx
// default's next-themes lookup (which has no provider to read from anyway).
function AppToaster() {
  return (
    <Toaster
      theme="light"
      position="top-center"
      icons={{
        success: <CircleCheckIcon className="size-4 text-[#3e7a52]" />,
        info: <InfoIcon className="size-4 text-[#7a5230]" />,
        warning: <TriangleAlertIcon className="size-4 text-[#b8860b]" />,
        error: <OctagonXIcon className="size-4 text-[#b34536]" />,
        loading: <Loader2Icon className="size-4 animate-spin text-[#7a5230]" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-start gap-3 rounded-xl border border-[#d4a373]/40 bg-[#fffcf7] p-4 shadow-[0_8px_24px_-6px_rgba(28,13,6,0.25)]',
          title: 'text-sm font-semibold text-[#1c0d06]',
          description: 'text-xs text-[#7a5230]',
          actionButton:
            'rounded-md bg-[#1c0d06] px-3 py-1.5 text-xs font-semibold text-[#f5ebe0] hover:opacity-90',
          cancelButton:
            'rounded-md px-3 py-1.5 text-xs font-medium text-[#7a5230] hover:text-[#1c0d06]',
          closeButton:
            'border border-[#d4a373]/40 !bg-[#fffcf7] text-[#7a5230] hover:bg-[#f5ebe0] hover:text-[#1c0d06]',
          error: 'border-[#b34536]/40',
          success: 'border-[#3e7a52]/40',
          warning: 'border-[#d4a843]/50',
        },
      }}
    />
  );
}

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: page(<LoginPage />) },
  { path: '/signup', element: page(<SignupPage />) },
  { path: '/reset-password', element: page(<ResetPasswordPage />) },
  { path: '/verify-email', element: page(<VerifyEmailPage />) },
  { path: '/r/:token', element: page(<SharedReportPage />) },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: page(<AppShell />),
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/projects/new', element: <ProjectCreatePage /> },
          { path: '/projects/:projectId', element: <ProjectDetailPage /> },
          { path: '/entries', element: <EntriesPage /> },
          { path: '/entries/new', element: <EntryCreatePage /> },
          { path: '/entries/as-at', element: <EntriesAsAtPage /> },
          { path: '/entries/:entryId', element: <EntryDetailPage /> },
          { path: '/entries/:entryId/history', element: <EntryHistoryPage /> },
          { path: '/entries/:id/edit', element: <EntryCreatePage /> },
          { path: '/suggestions', element: <SuggestionsPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <>
      <AppToaster />
      <RouterProvider router={router} />
    </>
  );
}
