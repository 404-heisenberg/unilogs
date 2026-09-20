import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { formatRelativeTime } from '@/lib/time';
import type { Notification } from '@/types';

function NotificationRow({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: number) => void;
}) {
  const unread = notification.readAt === null;

  return (
    <button
      type="button"
      onClick={() => unread && onRead(notification.id)}
      className={`flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors ${
        unread ? 'bg-[#f0e7db]' : 'hover:bg-[#f0e7db]/50'
      }`}
    >
      <span
        className={`mt-1 size-[8px] shrink-0 rounded-full ${unread ? 'bg-[#d4a843]' : 'bg-transparent'}`}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-[#1c0d06]">
          {notification.title}
        </span>
        <span className="mt-0.5 block text-[12px] leading-[17px] text-[#7a5230]">
          {notification.body}
        </span>
      </span>
      <span className="shrink-0 text-[11px] whitespace-nowrap text-[#a68c73]">
        {formatRelativeTime(notification.createdAt)}
      </span>
    </button>
  );
}

export default function NotificationList({ onNavigate }: { onNavigate?: () => void }) {
  const { feedQuery, markRead, markAllRead } = useNotifications();
  const notifications = feedQuery.data?.notifications ?? [];

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3.5">
        <p className="text-sm font-semibold text-[#1c0d06]">Notifications</p>
        {notifications.some((n) => n.readAt === null) && (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-xs text-[#7a5230] hover:text-[#1c0d06] disabled:opacity-50"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="h-px w-full bg-[#f0e7db]" />

      {feedQuery.isPending && (
        <div className="flex flex-col gap-2 p-4" aria-hidden>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-[#f0e7db]" />
          ))}
        </div>
      )}

      {feedQuery.isError && (
        <p className="px-4 py-6 text-center text-sm text-[#7a5230]">
          Couldn&apos;t load notifications.
        </p>
      )}

      {feedQuery.isSuccess && notifications.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <Bell size={20} strokeWidth={1.5} className="text-[#baa38c]" />
          <p className="text-sm text-[#7a5230]">No notifications yet.</p>
        </div>
      )}

      {notifications.length > 0 && (
        <ul className="flex max-h-[360px] flex-col divide-y divide-[#f0e7db] overflow-y-auto">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <NotificationRow notification={notification} onRead={(id) => markRead.mutate(id)} />
            </li>
          ))}
        </ul>
      )}

      <div className="h-px w-full bg-[#f0e7db]" />
      <Link
        to="/settings"
        onClick={onNavigate}
        className="px-4 py-3 text-xs font-semibold text-[#7a5230] hover:text-[#1c0d06]"
      >
        Notification settings
      </Link>
    </div>
  );
}
