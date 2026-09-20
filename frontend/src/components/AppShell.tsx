import { Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';
import NavRail from './app-shell/NavRail';
import ExplorerPane from './app-shell/ExplorerPane';
import AppHeader from './app-shell/AppHeader';
import MobileBottomNav from './app-shell/MobileBottomNav';
import MoreSheet from './app-shell/MoreSheet';

export default function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useSession();
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

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
    <div className="flex h-screen flex-col bg-[#faf7f2] md:flex-row">
      <NavRail
        explorerCollapsed={explorerCollapsed}
        onToggleExplorer={() => setExplorerCollapsed((v) => !v)}
      />
      <ExplorerPane collapsed={explorerCollapsed} user={data?.user} onSignOut={handleSignOut} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 text-[#1c0d06] md:p-8">
          <Outlet />
        </main>
        <MobileBottomNav moreOpen={moreOpen} onMoreClick={() => setMoreOpen(true)} />
      </div>

      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        user={data?.user}
        onSignOut={handleSignOut}
      />
    </div>
  );
}
