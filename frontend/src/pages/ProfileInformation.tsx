import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';
import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Folder,
  FileText,
  User as UserIcon,
  LogOut,
  Camera,
  Save,
  Trash2,
  AlertTriangle,
  X,
  Check,
  Lock,
} from 'lucide-react';
interface UserSessionObj {
  name?: string;
  fullName?: string;
  full_name?: string;
  username?: string;
  email?: string;
  image?: string;
  avatarUrl?: string;
}
interface SidebarNavProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onSignOut: () => void;
}

const SidebarNav: React.FC<SidebarNavProps> = ({ isCollapsed, onToggleCollapse, onSignOut }) => {
  return (
    <aside
      className={`flex flex-col justify-between border-r-2 border-[#d4af37] bg-[#1c0d06] text-[#f5ebe0] transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div>
        <header className="flex h-20 items-center justify-between border-b border-[#d4af37]/30 px-4">
          {!isCollapsed && (
            <h1 className="text-xl font-bold tracking-wider text-[#e6c687]">UNILOGS</h1>
          )}
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded-md p-2 text-[#e6c687] hover:bg-[#2a150a] focus:outline-none"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </header>

        <nav className="p-4">
          <ul className="flex flex-col gap-2">
            <li>
              <Link
                to="/dashboard"
                className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-[#f5ebe0] transition-colors hover:bg-[#2a150a] hover:text-[#d4af37]"
              >
                <LayoutDashboard size={20} className="shrink-0" />
                {!isCollapsed && <span>Dashboard</span>}
              </Link>
            </li>
            <li>
              <Link
                to="/projects"
                className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-[#f5ebe0] transition-colors hover:bg-[#2a150a] hover:text-[#d4af37]"
              >
                <Folder size={20} className="shrink-0" />
                {!isCollapsed && <span>Projects</span>}
              </Link>
            </li>
            <li>
              <Link
                to="/entries"
                className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-[#f5ebe0] transition-colors hover:bg-[#2a150a] hover:text-[#d4af37]"
              >
                <FileText size={20} className="shrink-0" />
                {!isCollapsed && <span>All Entries</span>}
              </Link>
            </li>
            <li>
              <Link
                to="/profile"
                className="flex w-full items-center gap-3 rounded-md bg-[#d4a373] p-3 font-semibold text-[#1c0d06] transition-colors"
              >
                <UserIcon size={20} className="shrink-0" />
                {!isCollapsed && <span>Profile Information</span>}
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <footer className="border-t border-[#d4af37]/30 p-4">
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-md p-3 font-semibold text-red-400 transition-colors hover:bg-red-950/40 hover:text-red-300"
        >
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </footer>
    </aside>
  );
};

interface PersonalInformationFormProps {
  name: string;
  onNameChange: (value: string) => void;
  avatarPreview: string | null;
  userInitial: string;
  userEmail: string;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  saveSuccess: boolean;
  isError: boolean;
}

const PersonalInformationForm: React.FC<PersonalInformationFormProps> = ({
  name,
  onNameChange,
  avatarPreview,
  userInitial,
  userEmail,
  onImageChange,
  onSubmit,
  isPending,
  saveSuccess,
  isError,
}) => {
  return (
    <div className="rounded-xl border border-[#d4af37]/30 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[#1c0d06] border-b border-[#d4a373]/20 pb-3 mb-6">
        Personal Information
      </h2>

      <form onSubmit={onSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-[#1c0d06] mb-3">Profile Picture</label>
          <div className="flex items-center gap-5">
            <div className="relative group">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="h-20 w-20 rounded-full object-cover border-2 border-[#d4af37] shadow-sm"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#d4af37] bg-[#1c0d06] text-2xl font-bold text-[#e6c687] shadow-sm">
                  {userInitial}
                </div>
              )}
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[#d4a373] text-[#1c0d06] shadow transition-transform hover:scale-105"
              >
                <Camera size={14} />
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={onImageChange}
                className="hidden"
              />
            </div>
            <div>
              <label
                htmlFor="avatar-upload"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#d4a373]/50 bg-white px-3 py-1.5 text-xs font-semibold text-[#1c0d06] hover:bg-[#f5ebe0] transition-colors"
              >
                <Camera size={14} className="text-[#7a5230]" /> Upload image
              </label>
              <p className="mt-1 text-xs text-[#7a5230]">JPG, PNG, or GIF. Max file size 5MB.</p>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="user-name" className="block text-sm font-medium text-[#1c0d06] mb-1">
            Display Name
          </label>
          <input
            id="user-name"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
            className="w-full rounded-xl border border-[#d4a373]/50 bg-white px-4 py-2.5 text-sm text-[#1c0d06] outline-none transition-all focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]"
          />
        </div>

        <div>
          <label htmlFor="user-email" className="block text-sm font-medium text-[#1c0d06] mb-1">
            Email Address
          </label>
          <input
            id="user-email"
            type="email"
            value={userEmail}
            disabled
            className="w-full rounded-xl border border-[#d4a373]/30 bg-[#f5ebe0]/60 px-4 py-2.5 text-sm text-[#7a5230] cursor-not-allowed outline-none"
          />
        </div>

        <div className="flex items-center gap-4 pt-2">
          <Button
            type="submit"
            disabled={isPending}
            className="border border-[#d4af37]/30 bg-[#1c0d06] text-[#f5ebe0] shadow-sm hover:bg-[#1c0d06]/90"
          >
            <Save className="mr-1.5 h-4 w-4 text-[#d4af37]" />
            {isPending ? 'Saving…' : 'Save Changes'}
          </Button>

          {saveSuccess && (
            <span className="flex items-center gap-1 text-sm text-emerald-800 font-medium">
              <Check size={16} /> Changes saved successfully!
            </span>
          )}

          {isError && (
            <span className="text-sm text-red-600">Failed to save changes. Please try again.</span>
          )}
        </div>
      </form>
    </div>
  );
};
interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  password: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  isError: boolean;
  errorMessage?: string;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  password,
  onPasswordChange,
  onSubmit,
  isPending,
  isError,
  errorMessage,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border-2 border-[#d4af37]">
        <div className="flex items-center justify-between pb-3 border-b border-[#d4a373]/20">
          <div className="flex items-center gap-2 text-red-800 font-semibold text-lg">
            <AlertTriangle size={20} /> Confirm Account Deletion
          </div>
          <button type="button" onClick={onClose} className="text-[#7a5230] hover:text-[#1c0d06]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <p className="text-sm text-[#7a5230]">
            To proceed with deleting your account, please enter your current password.
          </p>

          <div>
            <label
              htmlFor="delete-password"
              className="block text-sm font-medium text-[#1c0d06] mb-1"
            >
              Current Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7a5230]" />
              <input
                id="delete-password"
                type="password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-red-300 bg-white pl-9 pr-3 py-2 text-sm text-[#1c0d06] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
            </div>
          </div>

          {isError && (
            <p className="text-sm text-red-600">
              {errorMessage || 'Invalid password. Account deletion failed.'}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!password || isPending}
              className="bg-red-800 text-white hover:bg-red-900"
            >
              {isPending ? 'Deleting…' : 'Permanently Delete'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default function ProfileInformation() {
  const { data: sessionData } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [avatarInput, setAvatarInput] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [password, setPassword] = useState('');

  // Strictly typed user object resolution
  const userObj = (sessionData?.user || sessionData) as UserSessionObj | undefined;

  const name = nameInput ?? userObj?.name ?? userObj?.fullName ?? userObj?.full_name ?? '';
  const avatarPreview = avatarInput ?? userObj?.image ?? userObj?.avatarUrl ?? null;

  const updateProfile = useMutation({
    mutationFn: (payload: { name: string; avatarUrl?: string | null }) =>
      api.patch('/api/auth/profile', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] });
      setNameInput(null);
      setAvatarInput(null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const deleteAccount = useMutation<{ message: string }, Error, { password: string }>({
    mutationFn: (input: { password: string }) =>
      api.delete<{ message: string }>('/api/auth/account', input),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['session'] });
      navigate('/', { replace: true });
    },
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarInput(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ name, avatarUrl: avatarPreview });
  };

  const handleDeleteAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    deleteAccount.mutate({ password });
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setPassword('');
    deleteAccount.reset();
  };

  const handleSignOut = async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {
      // Proceed with redirect regardless of network status
    } finally {
      navigate('/login');
    }
  };

  const userName =
    userObj?.name ||
    userObj?.fullName ||
    userObj?.full_name ||
    userObj?.username ||
    (userObj?.email ? userObj.email.split('@')[0] : 'User');

  const userEmail = userObj?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#f5ebe0] text-[#1c0d06]">
      <SidebarNav
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onSignOut={handleSignOut}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-20 items-center justify-between border-b-2 border-[#d4af37] bg-[#1c0d06] px-8 text-[#f5ebe0] shadow-md">
          <h2 className="text-2xl font-bold tracking-tight text-[#e6c687]">PROFILE INFORMATION</h2>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[#f5ebe0]">{userName}</span>
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={userName}
                className="h-10 w-10 rounded-full object-cover border border-[#d4af37]"
              />
            ) : (
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d4af37] bg-[#d4a373] text-lg font-bold text-[#1c0d06]">
                {userInitial}
              </span>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-3xl space-y-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1c0d06]">Account Settings</h1>
              <p className="mt-1 text-sm text-[#7a5230]">
                Update your profile details and security settings.
              </p>
            </div>

            <PersonalInformationForm
              name={name}
              onNameChange={setNameInput}
              avatarPreview={avatarPreview}
              userInitial={userInitial}
              userEmail={userEmail}
              onImageChange={handleImageChange}
              onSubmit={handleSaveProfile}
              isPending={updateProfile.isPending}
              saveSuccess={saveSuccess}
              isError={updateProfile.isError}
            />

            <div className="rounded-xl border border-red-300 bg-red-50/60 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-red-950 border-b border-red-200 pb-3 mb-3">
                Danger Zone
              </h2>
              <p className="text-sm text-red-800 mb-4">
                Permanently delete your account, projects, and log entries. This cannot be undone.
              </p>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsDeleteModalOpen(true)}
                className="bg-red-800 text-white hover:bg-red-900"
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete Account
              </Button>
            </div>
          </div>
        </main>
      </div>

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        password={password}
        onPasswordChange={setPassword}
        onSubmit={handleDeleteAccount}
        isPending={deleteAccount.isPending}
        isError={deleteAccount.isError}
        errorMessage={deleteAccount.error?.message}
      />
    </div>
  );
}
