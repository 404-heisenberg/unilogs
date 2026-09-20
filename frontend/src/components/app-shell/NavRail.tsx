import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PanelLeft, Settings } from 'lucide-react';
import { primaryNavItems, isNavActive, type NavItem } from './nav-items';
import NotificationBell from './NotificationBell';

const RailLink = memo(function RailLink({ to, label, icon: Icon }: NavItem) {
  const { pathname } = useLocation();
  const active = isNavActive(pathname, to);

  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`flex size-10 items-center justify-center rounded-lg transition-colors ${
        active
          ? 'border border-[#d4a843] bg-[#3a2a1e] text-[#d4a843]'
          : 'text-[#f5ebe0] hover:bg-white/5'
      }`}
    >
      <Icon size={20} strokeWidth={1.75} />
    </Link>
  );
});

const settingsItem: NavItem = { to: '/settings', label: 'Settings', icon: Settings };

export default function NavRail({
  explorerCollapsed,
  onToggleExplorer,
}: {
  explorerCollapsed: boolean;
  onToggleExplorer: () => void;
}) {
  return (
    <aside className="hidden w-16 shrink-0 flex-col items-center justify-between bg-[#1c1109] py-6 md:flex">
      <div className="flex w-full flex-col items-center gap-6">
        <button
          type="button"
          onClick={onToggleExplorer}
          aria-label={explorerCollapsed ? 'Expand explorer' : 'Collapse explorer'}
          aria-pressed={!explorerCollapsed}
          className="flex size-8 items-center justify-center rounded-md text-[#f5ebe0] hover:bg-white/5"
        >
          <PanelLeft size={20} strokeWidth={1.75} />
        </button>

        <div className="flex size-9 items-center justify-center rounded-lg bg-[#d4a843]">
          <span className="text-base font-extrabold text-[#1c1109]">UL</span>
        </div>

        <nav className="flex w-full flex-col items-center gap-4">
          {primaryNavItems.map((item) => (
            <RailLink key={item.to} {...item} />
          ))}
        </nav>
      </div>

      <div className="flex w-full flex-col items-center gap-2">
        <NotificationBell />
        <RailLink {...settingsItem} />
      </div>
    </aside>
  );
}
