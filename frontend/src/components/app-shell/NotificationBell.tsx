import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationList from './NotificationList';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  // Only mounted while the rail exists (desktop), and the popover content
  // below only renders its list while open — the feed query itself stays
  // active for the badge count, but nothing heavier re-renders per poll tick.
  const { feedQuery } = useNotifications();
  const unreadCount = feedQuery.data?.unreadCount ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          className="relative flex size-10 items-center justify-center rounded-lg text-[#f5ebe0] transition-colors hover:bg-white/5"
        >
          <Bell size={20} strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex size-[8px] rounded-full bg-[#d4a843]" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={12}
        className="w-[320px] rounded-xl border border-[#d4c4b0] bg-[#fffcf7] p-0 shadow-[0px_4px_16px_0px_rgba(0,0,0,0.12)]"
      >
        <NotificationList onNavigate={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
