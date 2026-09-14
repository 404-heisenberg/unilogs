import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';
import {
  LayoutDashboard,
  FolderKanban,
  BookOpen,
  Settings,
  LogOut,
  ChevronLeft,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/entries', label: 'Entries', icon: BookOpen },
];

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleSignOut = async () => {
    await api.post('/api/auth/sign-out');
    queryClient.removeQueries({ queryKey: ['session'] });
    navigate('/login');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

      if (e.key === 'n' && !isTyping) {
        e.preventDefault();
        navigate('/entries/new');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Determine current page title for the top banner
  const getCurrentPageTitle = () => {
    if (location.pathname === '/settings') return 'Settings';
    const currentNavItem = navItems.find((item) => item.to === location.pathname);
    if (currentNavItem) return currentNavItem.label;

    // Fallback for dynamic/nested routes
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      return (
        segments[segments.length - 1].charAt(0).toUpperCase() +
        segments[segments.length - 1].slice(1)
      );
    }
    return 'Dashboard';
  };

  return (
    <div className="flex h-screen bg-[#f5ebe0]">
      <aside
        className={`flex flex-col justify-between bg-[#1c0d06] p-4 text-[#f5ebe0] transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div>
          <div className="mb-6 flex items-center justify-between px-2 py-2">
            {!isCollapsed && (
              <span className="text-lg font-bold tracking-tight text-[#e6c687]">UniLogs</span>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="rounded-md bg-[#1c0d06] p-1.5 text-[#d4a373] transition-colors hover:bg-[#2c150b] hover:text-[#e6c687]"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <ChevronLeft
                className={`h-5 w-5 transition-transform duration-300 ${
                  isCollapsed ? 'rotate-180' : ''
                }`}
              />
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={isCollapsed ? item.label : undefined}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors bg-[#1c0d06] ${
                    isActive
                      ? 'bg-[#e6c687]/20 font-semibold text-[#e6c687]'
                      : 'text-[#d4a373] hover:bg-[#2c150b] hover:text-[#e6c687]'
                  }`}
                >
                  <IconComponent className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#d4a373]/20 pt-4">
          {!isCollapsed && data?.user && (
            <div className="mb-3 rounded-md bg-[#2c150b] px-3 py-2">
              <p className="truncate text-sm font-medium text-[#f5ebe0]">{data.user.name}</p>
              <p className="truncate text-xs text-[#d4a373]">{data.user.email}</p>
            </div>
          )}
          <Link
            to="/settings"
            title={isCollapsed ? 'Settings' : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors bg-[#1c0d06] ${
              location.pathname === '/settings'
                ? 'bg-[#e6c687]/20 font-semibold text-[#e6c687]'
                : 'text-[#d4a373] hover:bg-[#2c150b] hover:text-[#e6c687]'
            }`}
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span className="truncate">Settings</span>}
          </Link>
          <button
            onClick={handleSignOut}
            title={isCollapsed ? 'Sign out' : undefined}
            className="flex w-full items-center gap-3 rounded-md bg-[#1c0d06] px-3 py-2 text-left text-sm text-[#e6c687]/70 transition-colors hover:bg-[#2c150b] hover:text-[#e6c687]"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span className="truncate">Sign out</span>}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-[69px] items-center justify-between bg-[#1c0d06] px-8 text-[#f5ebe0] border-b border-[#d4a373]/20 shadow-sm">
          <h1 className="text-lg font-semibold tracking-wide text-[#e6c687]">
            {getCurrentPageTitle()}
          </h1>
          {data?.user && (
            <div className="text-xs text-[#d4a373]">
              Signed in as <span className="font-medium text-[#f5ebe0]">{data.user.name}</span>
            </div>
          )}
        </header>
        <main className="flex-1 overflow-y-auto p-8 text-[#1c0d06]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
