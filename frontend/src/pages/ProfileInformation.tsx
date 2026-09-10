import { useState, useEffect } from 'react';
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

export default function ProfileInformation() {
  const { data: sessionData } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Layout State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Profile Form State
  const [name, setName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Deletion Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [password, setPassword] = useState('');

  // Synchronize initial session data
  useEffect(() => {
    if (sessionData?.user) {
      setName(sessionData.user.name || '');
      setAvatarPreview(sessionData.user.image || sessionData.user.avatarUrl || null);
    }
  }, [sessionData]);

  // Profile Update Mutation
  const updateProfile = useMutation({
    mutationFn: (payload: { name: string; avatarUrl?: string | null }) =>
      api.patch('/api/auth/profile', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  // Account Delete Mutation (Password Required)
  const deleteAccount = useMutation({
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
        setAvatarPreview(reader.result as string);
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
      await api.post('/api/auth/logout');
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

  const userName = sessionData?.user?.name || 'Student User';
  const userEmail = sessionData?.user?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#f5ebe0]">
      {/* 1. COLLAPSIBLE SIDEBAR */}
      <aside
        className={`relative flex flex-col justify-between border-r border-[#d4af37]/40 bg-[#1c0d06] text-[#f5ebe0] transition-all duration-300 ${
          isSidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div>
          {/* Sidebar Header */}
          <div className="flex h-16 items-center justify-between border-b border-[#d4af37]/30 px-4">
            {!isSidebarCollapsed && (
              <span className="text-xl font-bold tracking-wider text-[#d4af37]">UNILOGS</span>
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="rounded-lg p-1.5 text-[#d4af37] hover:bg-[#d4af37]/10"
              aria-label="Toggle Sidebar"
            >
              {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 flex flex-col gap-1 px-3">
            <Link
              to="/dashboard"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#f5ebe0]/80 transition-colors hover:bg-[#d4af37]/10 hover:text-[#d4af37]"
            >
              <LayoutDashboard size={18} />
              {!isSidebarCollapsed && <span>Dashboard</span>}
            </Link>

            <Link
              to="/projects"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#f5ebe0]/80 transition-colors hover:bg-[#d4af37]/10 hover:text-[#d4af37]"
            >
              <Folder size={18} />
              {!isSidebarCollapsed && <span>Projects</span>}
            </Link>

            <Link
              to="/entries"
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#f5ebe0]/80 transition-colors hover:bg-[#d4af37]/10 hover:text-[#d4af37]"
            >
              <FileText size={18} />
              {!isSidebarCollapsed && <span>All Entries</span>}
            </Link>

            <Link
              to="/profile"
              className="flex items-center gap-3 rounded-lg bg-[#d4af37]/20 px-3 py-2.5 text-sm font-medium text-[#d4af37]"
            >
              <UserIcon size={18} />
              {!isSidebarCollapsed && <span>Profile</span>}
            </Link>
          </nav>
        </div>

        {/* Sidebar Footer / Sign Out */}
        <div className="border-t border-[#d4af37]/30 p-3">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
          >
            <LogOut size={18} />
            {!isSidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* 2. MAIN LAYOUT AREA */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* TOP BANNER / HEADER */}
        <header className="flex h-16 items-center justify-between border-b border-[#d4af37]/30 bg-white px-8 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-[#1c0d06]">Profile Settings</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[#7a5230]">{userName}</span>
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt={userName}
                className="h-9 w-9 rounded-full object-cover border border-[#d4af37]"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1c0d06] text-sm font-bold text-[#d4af37]">
                {userInitial}
              </div>
            )}
          </div>
        </header>

        {/* MAIN CONTENT BODY */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-3xl space-y-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1c0d06]">Account Settings</h1>
              <p className="mt-1 text-sm text-[#7a5230]">
                Update your profile details and security settings.
              </p>
            </div>

            {/* Profile Information Form */}
            <div className="rounded-xl border border-[#d4af37]/30 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-[#1c0d06] border-b border-[#d4a373]/20 pb-3 mb-6">
                Personal Information
              </h2>

              <form onSubmit={handleSaveProfile} className="space-y-6">
                {/* Profile Picture Upload Section */}
                <div>
                  <label className="block text-sm font-medium text-[#1c0d06] mb-3">
                    Profile Picture
                  </label>
                  <div className="flex items-center gap-5">
                    <div className="relative group">
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Avatar preview"
                          className="h-20 w-20 rounded-full object-cover border-2 border-[#d4af37] shadow-sm"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1c0d06] text-2xl font-bold text-[#d4af37] shadow-sm">
                          {userInitial}
                        </div>
                      )}
                      <label
                        htmlFor="avatar-upload"
                        className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[#d4af37] text-[#1c0d06] shadow transition-transform hover:scale-105"
                      >
                        <Camera size={14} />
                      </label>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="avatar-upload"
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#d4a373]/50 bg-white px-3 py-1.5 text-xs font-medium text-[#1c0d06] hover:bg-[#f5ebe0] transition-colors"
                      >
                        <Camera size={14} /> Upload image
                      </label>
                      <p className="mt-1 text-xs text-[#7a5230]">
                        JPG, PNG, or GIF. Max file size 5MB.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Display Name Input */}
                <div>
                  <label
                    htmlFor="user-name"
                    className="block text-sm font-medium text-[#1c0d06] mb-1"
                  >
                    Display Name
                  </label>
                  <input
                    id="user-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-[#d4a373]/50 bg-white px-4 py-2 text-sm text-[#1c0d06] outline-none transition-all focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]"
                  />
                </div>

                {/* Email (Read-Only) */}
                <div>
                  <label
                    htmlFor="user-email"
                    className="block text-sm font-medium text-[#1c0d06] mb-1"
                  >
                    Email Address
                  </label>
                  <input
                    id="user-email"
                    type="email"
                    value={userEmail}
                    disabled
                    className="w-full rounded-xl border border-[#d4a373]/30 bg-[#f5ebe0]/40 px-4 py-2 text-sm text-[#7a5230] cursor-not-allowed outline-none"
                  />
                </div>

                {/* Save Profile Button */}
                <div className="flex items-center gap-4 pt-2">
                  <Button
                    type="submit"
                    disabled={updateProfile.isPending}
                    className="bg-[#1c0d06] text-[#f5ebe0] shadow-sm hover:bg-[#1c0d06]/90 border border-[#d4af37]/30"
                  >
                    <Save className="mr-1.5 h-4 w-4 text-[#d4af37]" />
                    {updateProfile.isPending ? 'Saving…' : 'Save Changes'}
                  </Button>

                  {saveSuccess && (
                    <span className="flex items-center gap-1 text-sm text-emerald-700 font-medium">
                      <Check size={16} /> Changes saved successfully!
                    </span>
                  )}

                  {updateProfile.isError && (
                    <span className="text-sm text-red-600">
                      Failed to save changes. Please try again.
                    </span>
                  )}
                </div>
              </form>
            </div>

            {/* Danger Zone */}
            <div className="rounded-xl border border-red-300/80 bg-red-50/50 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-red-900 border-b border-red-200 pb-3 mb-3">
                Danger Zone
              </h2>
              <p className="text-sm text-red-700 mb-4">
                Permanently delete your account, projects, and log entries. This cannot be undone.
              </p>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsDeleteModalOpen(true)}
                className="bg-red-700 hover:bg-red-800 text-white"
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete Account
              </Button>
            </div>
          </div>
        </main>
      </div>

      {/* 3. PASSWORD CONFIRMATION MODAL */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-[#d4af37]/30">
            <div className="flex items-center justify-between pb-3 border-b border-[#d4a373]/20">
              <div className="flex items-center gap-2 text-red-800 font-semibold text-lg">
                <AlertTriangle size={20} /> Confirm Account Deletion
              </div>
              <button
                onClick={handleCloseDeleteModal}
                className="text-[#7a5230] hover:text-[#1c0d06]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDeleteAccount} className="mt-4 space-y-4">
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
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    className="w-full rounded-xl border border-red-300 bg-white pl-9 pr-3 py-2 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {deleteAccount.isError && (
                <p className="text-sm text-red-600">
                  {deleteAccount.error?.message || 'Invalid password. Account deletion failed.'}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={handleCloseDeleteModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!password || deleteAccount.isPending}
                  className="bg-red-700 hover:bg-red-800"
                >
                  {deleteAccount.isPending ? 'Deleting…' : 'Permanently Delete'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
