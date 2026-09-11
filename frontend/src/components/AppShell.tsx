import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/projects', label: 'Projects' },
  { to: '/projects/new', label: 'New Project' },
  { to: '/entries', label: 'Entries' },
  { to: '/entries/new', label: 'New Entry' },
];

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data } = useSession();

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

  return (
    <div className="flex h-screen bg-[#f5ebe0]">
      <aside className="flex w-64 flex-col justify-between bg-[#1c0d06] p-4 text-[#f5ebe0]">
        <div>
          <div className="mb-6 px-2 py-2">
            <span className="text-lg font-bold tracking-tight text-[#e6c687]">UniLogs</span>
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-[#e6c687]/20 font-semibold text-[#e6c687]'
                      : 'text-[#d4a373] hover:bg-white/5 hover:text-[#e6c687]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-[#d4a373]/20 pt-4">
          {data?.user && (
            <div className="mb-3 rounded-md bg-white/5 px-3 py-2">
              <p className="text-sm font-medium text-[#f5ebe0]">{data.user.name}</p>
              <p className="text-xs text-[#d4a373]">{data.user.email}</p>
            </div>
          )}
          <Link
            to="/settings"
            className={`block rounded-md px-3 py-2 text-sm transition-colors ${
              location.pathname === '/settings'
                ? 'bg-[#e6c687]/20 font-semibold text-[#e6c687]'
                : 'text-[#d4a373] hover:bg-white/5 hover:text-[#e6c687]'
            }`}
          >
            Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-[#e6c687]/70 transition-colors hover:bg-white/5 hover:text-[#e6c687]"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8 text-[#1c0d06]">
        <Outlet />
      </main>
    </div>
  );
}
