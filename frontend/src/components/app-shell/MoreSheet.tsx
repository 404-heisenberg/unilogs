import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronDown, Settings } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useNotifications } from '@/hooks/useNotifications';
import type { SessionUser } from '@/hooks/useSession';
import NotificationList from './NotificationList';
import ProjectExplorer from './ProjectExplorer';
import UserFooter from './UserFooter';

function NotificationsDisclosure({ onNavigate }: { onNavigate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  // Lazy: the feed only fetches once this row is mounted, i.e. once the
  // sheet itself is open — never on every shell poll tick.
  const { feedQuery } = useNotifications();
  const unreadCount = feedQuery.data?.unreadCount ?? 0;

  return (
    <div className="rounded-md border border-[#f0e7db]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-2 py-2 text-sm font-medium text-[#1c0d06]"
      >
        <Bell size={18} strokeWidth={1.75} />
        <span className="flex-1 text-left">Notifications</span>
        {unreadCount > 0 && (
          <span className="rounded-full bg-[#d4a843] px-1.5 py-0.5 text-[11px] font-semibold text-[#1c0d06]">
            {unreadCount}
          </span>
        )}
        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`text-[#7a5230] transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="border-t border-[#f0e7db]">
          <NotificationList onNavigate={onNavigate} />
        </div>
      )}
    </div>
  );
}

export default function MoreSheet({
  open,
  onOpenChange,
  user,
  onSignOut,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SessionUser | undefined;
  onSignOut: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-4/5 flex-col gap-5 bg-[#fffcf7] p-4 sm:max-w-xs">
        <SheetHeader className="p-0">
          <SheetTitle>More</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <ProjectExplorer />
        </div>

        <NotificationsDisclosure onNavigate={() => onOpenChange(false)} />

        <Link
          to="/settings"
          onClick={() => onOpenChange(false)}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-[#1c0d06] hover:bg-black/5"
        >
          <Settings size={18} strokeWidth={1.75} />
          Settings
        </Link>

        <UserFooter user={user} onSignOut={onSignOut} />
      </SheetContent>
    </Sheet>
  );
}
