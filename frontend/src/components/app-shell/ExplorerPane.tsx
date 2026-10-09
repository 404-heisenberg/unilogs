import ProjectExplorer from './ProjectExplorer';

// Figma's explorer is just the project tree; sign-out lives in Settings.
// The pane stays mounted and animates its width and opacity so collapsing
// doesn't pop (Round 2: "the pop in and out is jarring").
export default function ExplorerPane({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      aria-hidden={collapsed}
      className={`hidden shrink-0 flex-col overflow-hidden border-r transition-all duration-200 ease-out md:flex ${
        collapsed ? 'w-0 border-rule/0 opacity-0 invisible' : 'w-64 border-rule opacity-100 visible'
      }`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto bg-explorer p-4">
        <ProjectExplorer />
      </div>
    </aside>
  );
}
