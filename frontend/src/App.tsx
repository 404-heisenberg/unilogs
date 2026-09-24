import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route
          path="/r/:token"
          element={
            <Suspense fallback={null}>
              <SharedReportPage />
            </Suspense>
          }
        />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/new" element={<ProjectCreatePage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/entries" element={<EntriesPage />} />
            <Route path="/entries/new" element={<EntryCreatePage />} />
            <Route path="/entries/:entryId" element={<EntryDetailPage />} />
            <Route path="/entries/:id/edit" element={<EntryCreatePage />} />
            <Route path="/suggestions" element={<SuggestionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
