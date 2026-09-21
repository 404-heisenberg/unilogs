import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
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

export default function App() {
  return (
    <BrowserRouter>
      <AppToaster />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/new" element={<ProjectCreatePage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/entries" element={<EntriesPage />} />
            <Route path="/entries/new" element={<EntryCreatePage />} />
            <Route path="/entries/:entryId" element={<EntryDetailPage />} />
            <Route path="/suggestions" element={<SuggestionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
