import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { SessionUser } from '@/hooks/useSession';
import ProjectExplorer from './ProjectExplorer';
import UserFooter from './UserFooter';

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
