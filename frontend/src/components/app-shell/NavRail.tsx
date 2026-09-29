import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { PanelLeft, Settings } from 'lucide-react';
import { primaryNavItems, isNavActive, type NavItem } from './nav-items';
import NotificationBell from './NotificationBell';
import { useSession } from '@/hooks/useSession';
import { initialsFromName } from '@/lib/initials';

const RailLink = memo(function RailLink({ to, label, icon: Icon }: NavItem) {
  const { pathname } = useLocation();
  const active = isNavActive(pathname, to);

  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={`flex size-10 items-center justify-center rounded-lg transition-colors ${
        active ? 'border border-gold bg-rail-active text-gold' : 'text-cream hover:bg-white/5'
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
  const { data } = useSession();
  const name = data?.user.name;
  const initials = initialsFromName(name);

  return (
    <aside className="hidden w-16 shrink-0 flex-col items-center justify-between bg-rail py-6 md:flex">
      <div className="flex w-full flex-col items-center gap-6">
        <button
          type="button"
          onClick={onToggleExplorer}
          aria-label={explorerCollapsed ? 'Expand explorer' : 'Collapse explorer'}
          aria-pressed={!explorerCollapsed}
          className="flex size-8 items-center justify-center rounded-md text-cream hover:bg-white/5"
        >
          <PanelLeft size={20} strokeWidth={1.75} />
        </button>

        <nav className="flex w-full flex-col items-center gap-4">
          {primaryNavItems.map((item) => (
            <RailLink key={item.to} {...item} />
          ))}
        </nav>
      </div>

      <div className="flex w-full flex-col items-center gap-2">
        <NotificationBell />

        {/* An avatar badge beside the settings wheel, rather than a product
            monogram in the navbar. User testing round 2: a `UL` monogram read
            as inert to one participant and clickable to another, and neither
            inferred what it was for. Initials are a convention people already
            understand. */}
        <Link
          to="/settings?tab=account"
          aria-label="Your account"
          title={name ? `Your account (${name})` : 'Your account'}
          className="flex size-10 items-center justify-center rounded-full bg-gold"
        >
          <span className="text-sm font-extrabold text-rail">{initials || '?'}</span>
        </Link>

        <RailLink {...settingsItem} />
      </div>
    </aside>
  );
}
