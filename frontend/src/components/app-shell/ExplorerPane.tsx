import type { SessionUser } from '@/hooks/useSession';
import ProjectExplorer from './ProjectExplorer';
import UserFooter from './UserFooter';

export default function ExplorerPane({
  collapsed,
  user,
  onSignOut,
}: {
  collapsed: boolean;
  user: SessionUser | undefined;
  onSignOut: () => void;
}) {
  if (collapsed) return null;

  return (
    <aside className="hidden w-64 shrink-0 flex-col justify-between gap-5 overflow-y-auto border-r border-[#5c4a3a] bg-[#e8ddd0] p-4 md:flex">
      <ProjectExplorer />
      <UserFooter user={user} onSignOut={onSignOut} />
    </aside>
  );
}
