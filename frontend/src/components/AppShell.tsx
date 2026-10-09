import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Suspense, useEffect, useState } from 'react';
import Skeleton from '@/components/Skeleton';
import NavRail from './app-shell/NavRail';
import ExplorerPane from './app-shell/ExplorerPane';
import AppHeader from './app-shell/AppHeader';
import InstallPrompt from './app-shell/InstallPrompt';
import MobileBottomNav from './app-shell/MobileBottomNav';
import MoreSheet from './app-shell/MoreSheet';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

export default function AppShell() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Replays anything still in the offline queue on every app load, not just
  // when the entry editor happens to be open. Returns are ignored on purpose:
  // this call exists for its listeners and its first flush.
  useOfflineQueue();

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
    <div className="flex h-screen flex-col bg-canvas md:flex-row">
      <NavRail
        explorerCollapsed={explorerCollapsed}
        onToggleExplorer={() => setExplorerCollapsed((v) => !v)}
      />
      <ExplorerPane collapsed={explorerCollapsed} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader />
        <InstallPrompt />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 text-espresso md:p-12">
          {/* Pages are lazy-loaded (see App.tsx). Keeping the boundary inside
              the shell means navigation stays on screen while a page's chunk
              downloads, instead of the whole shell blanking out. */}
          <Suspense fallback={<Skeleton rows={4} className="max-w-xl" />}>
            <Outlet />
          </Suspense>
        </main>
        {/* The as-at view is full screen on mobile, as in Figma: its header
            back arrow is the way out. */}
        {pathname !== '/entries/as-at' && (
          <MobileBottomNav moreOpen={moreOpen} onMoreClick={() => setMoreOpen(true)} />
        )}
      </div>

      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </div>
  );
}
