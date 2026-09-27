import { Link } from 'react-router-dom';
import { Bell, Calendar, ChevronRight, Settings, Tag, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCalendarConnection } from '@/hooks/useCalendarConnection';
import { useNotifications } from '@/hooks/useNotifications';
import { useTags } from '@/hooks/useTags';
import NotificationList from './NotificationList';

function MenuRow({
  to,
  icon: Icon,
  label,
  meta,
  onNavigate,
}: {
  to: string;
  icon: typeof Bell;
  label: string;
  meta?: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <li className="border-b border-cream last:border-b-0">
      <Link
        to={to}
        onClick={onNavigate}
        className="flex min-h-12 items-center gap-3 px-4 text-[15px] text-espresso"
      >
        <Icon size={18} strokeWidth={1.75} className="shrink-0 text-cocoa" aria-hidden />
        <span className="flex-1">{label}</span>
        {meta}
        <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-clay" aria-hidden />
      </Link>
    </li>
  );
}

// Figma's mobile "More" tab: a menu card (Notifications, Settings, Tags,
// Google Calendar) above the recent notifications. The feed, tags and
// calendar status only fetch while the sheet is open (this content mounts
// with it), never on every shell poll tick.
function MoreContent({ onNavigate }: { onNavigate: () => void }) {
  const { feedQuery } = useNotifications();
  const { tagsQuery } = useTags();
  const { statusQuery } = useCalendarConnection();
  const unreadCount = feedQuery.data?.unreadCount ?? 0;
  const tagCount = tagsQuery.data?.length;

  return (
    <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-6">
      <ul className="rounded-xl border border-line bg-paper">
        <MenuRow
          to="/settings"
          icon={Bell}
          label="Notifications"
          onNavigate={onNavigate}
          meta={
            unreadCount > 0 && (
              <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-semibold text-espresso">
                {unreadCount} new
              </span>
            )
          }
        />
        <MenuRow to="/settings" icon={Settings} label="Settings" onNavigate={onNavigate} />
        <MenuRow
          to="/settings"
          icon={Tag}
          label="Tags"
          onNavigate={onNavigate}
          meta={
            tagCount !== undefined && (
              <span className="text-[13px] text-clay">
                {tagCount} {tagCount === 1 ? 'tag' : 'tags'}
              </span>
            )
          }
        />
        <MenuRow
          to="/settings"
          icon={Calendar}
          label="Google Calendar"
          onNavigate={onNavigate}
          meta={
            statusQuery.isSuccess && (
              <span
                className={`text-[13px] ${statusQuery.data.connected ? 'text-success' : 'text-clay'}`}
              >
                {statusQuery.data.connected ? 'Connected' : 'Not connected'}
              </span>
            )
          }
        />
      </ul>

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] font-semibold text-clay">Recent notifications</h2>
        <div className="overflow-hidden rounded-xl border border-line bg-paper">
          <NotificationList onNavigate={onNavigate} />
        </div>
      </section>
    </div>
  );
}

export default function MoreSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="flex w-full flex-col gap-4 bg-canvas p-0 sm:max-w-sm"
      >
        <SheetHeader className="flex-row items-center justify-between border-b border-rule px-2 py-0">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex size-11 shrink-0 items-center justify-center text-espresso"
          >
            <X size={20} strokeWidth={2} />
          </button>
          <SheetTitle className="px-2 py-4 text-lg font-bold text-espresso">More</SheetTitle>
        </SheetHeader>

        <MoreContent onNavigate={close} />
      </SheetContent>
    </Sheet>
  );
}
