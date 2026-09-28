import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectCreatePage from './pages/ProjectCreatePage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import EntriesPage from './pages/EntriesPage';
import EntryCreatePage from './pages/EntryCreatePage';
import EntryDetailPage from './pages/EntryDetailPage';
import DashboardPage from './pages/DashboardPage';
import SuggestionsPage from './pages/SuggestionsPage';
import SettingsPage from './pages/SettingsPage';

// Public share page: lazy-loaded so no app/auth code ships with it.
const SharedReportPage = lazy(() => import('./pages/SharedReportPage'));

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/reset-password', element: <ResetPasswordPage /> },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  {
    path: '/r/:token',
    element: (
      <Suspense fallback={null}>
        <SharedReportPage />
      </Suspense>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/projects/new', element: <ProjectCreatePage /> },
          { path: '/projects/:projectId', element: <ProjectDetailPage /> },
          { path: '/entries', element: <EntriesPage /> },
          { path: '/entries/new', element: <EntryCreatePage /> },
          { path: '/entries/:entryId', element: <EntryDetailPage /> },
          { path: '/entries/:id/edit', element: <EntryCreatePage /> },
          { path: '/suggestions', element: <SuggestionsPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
