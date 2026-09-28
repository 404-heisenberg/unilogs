import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Ellipsis } from 'lucide-react';
import { primaryNavItems, isNavActive, type NavItem } from './nav-items';

const BottomNavLink = memo(function BottomNavLink({ to, label, icon: Icon }: NavItem) {
  const { pathname } = useLocation();
  const active = isNavActive(pathname, to);

  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`flex h-full w-16 flex-col items-center justify-center gap-1 ${
        active ? 'text-gold' : 'text-cream'
      }`}
    >
      <Icon size={20} strokeWidth={1.75} />
      <span className={`text-[10px] ${active ? 'font-semibold' : ''}`}>{label}</span>
    </Link>
  );
});

export default function MobileBottomNav({
  moreOpen,
  onMoreClick,
}: {
  moreOpen: boolean;
  onMoreClick: () => void;
}) {
  return (
    <nav className="flex h-16 shrink-0 justify-between bg-rail px-4 md:hidden">
      {primaryNavItems.map((item) => (
        <BottomNavLink key={item.to} {...item} />
      ))}
      <button
        type="button"
        onClick={onMoreClick}
        aria-haspopup="dialog"
        aria-expanded={moreOpen}
        className={`flex h-full w-16 flex-col items-center justify-center gap-1 ${
          moreOpen ? 'text-gold' : 'text-cream'
        }`}
      >
        <Ellipsis size={20} strokeWidth={1.75} />
        <span className={`text-[10px] ${moreOpen ? 'font-semibold' : ''}`}>More</span>
      </button>
    </nav>
  );
}
