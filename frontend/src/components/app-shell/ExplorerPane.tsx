import ProjectExplorer from './ProjectExplorer';

// Figma's explorer is just the project tree; sign-out lives in Settings.
export default function ExplorerPane({ collapsed }: { collapsed: boolean }) {
  if (collapsed) return null;

  return (
    <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-rule bg-explorer p-4 md:flex">
      <ProjectExplorer />
    </aside>
  );
}
