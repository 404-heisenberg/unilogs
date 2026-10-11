import { Link } from 'react-router-dom';
import { Bell, CalendarDays, ChevronRight } from 'lucide-react';
import Skeleton from '@/components/Skeleton';
import { useNotifications } from '@/hooks/useNotifications';
import { projectColor } from '@/lib/colors';
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
        unread ? 'bg-sand' : 'hover:bg-sand/50'
      }`}
    >
      {/* Figma 103:284: a project reminder is marked with the project's
          colour, anything else (summaries) with a calendar; read or not. */}
      <span className="flex w-3.5 shrink-0 justify-start pt-1" aria-hidden>
        {notification.projectId !== null ? (
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: projectColor(notification.projectId) }}
          />
        ) : (
          <CalendarDays className="size-3.5 text-clay" strokeWidth={1.75} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-espresso">
          {notification.title}
        </span>
        <span className="mt-0.5 block text-[12px] leading-[17px] text-clay">
          {notification.body}
        </span>
      </span>
      <span className="shrink-0 text-[11px] whitespace-nowrap text-taupe">
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
        <p className="text-sm font-semibold text-espresso">Notifications</p>
        {notifications.some((n) => n.readAt === null) && (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="text-xs font-semibold text-clay hover:text-espresso disabled:opacity-50"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="h-px w-full bg-sand" />

      {feedQuery.isPending && (
        <Skeleton rows={3} barClassName="h-12 rounded-md bg-sand" className="p-4" />
      )}

      {feedQuery.isError && (
        <p className="px-4 py-6 text-center text-sm text-clay">Couldn&apos;t load notifications.</p>
      )}

      {feedQuery.isSuccess && notifications.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <Bell size={20} strokeWidth={1.5} className="text-line-strong" />
          <p className="text-sm text-clay">No notifications yet.</p>
        </div>
      )}

      {notifications.length > 0 && (
        <ul className="flex max-h-[360px] flex-col divide-y divide-sand overflow-y-auto">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <NotificationRow notification={notification} onRead={(id) => markRead.mutate(id)} />
            </li>
          ))}
        </ul>
      )}

      <div className="h-px w-full bg-sand" />
      <Link
        to="/settings?tab=app"
        onClick={onNavigate}
        className="flex items-center gap-1.5 px-4 py-3 text-xs font-semibold text-clay hover:text-espresso"
      >
        <ChevronRight className="size-3.5" strokeWidth={1.75} aria-hidden />
        Notification settings
      </Link>
    </div>
  );
}
