import { useState, type ReactNode } from 'react';
import { PanelRight } from 'lucide-react';

// Figma's workspace layout: the page content, plus a full-height 288px pane
// on the right (Properties / Metadata) with a cream left border. The wrapper
// cancels AppShell's <main> padding so the pane reaches the top and right
// edges, then re-applies it to the content column. The pane can be collapsed
// to a slim strip via the chevron toggle. Below lg the pane stacks under the
// content.
export default function PaneLayout({
  children,
  pane,
  paneLabel,
}: {
  children: ReactNode;
  pane: ReactNode;
  paneLabel: string;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="-m-4 flex min-h-[calc(100%+2rem)] flex-col md:-m-12 md:min-h-[calc(100%+6rem)] lg:flex-row">
      <div className="min-w-0 flex-1 p-4 md:p-12">{children}</div>
      <aside
        aria-label={paneLabel}
        className={`relative flex flex-col border-t border-cream bg-paper lg:shrink-0 lg:border-t-0 lg:border-l ${
          collapsed ? 'lg:w-14' : 'lg:w-72'
        }`}
      >
        {/* Expanded on desktop, Figma puts the toggle on the pane's label row. */}
        <div
          className={`flex shrink-0 p-2 ${
            collapsed ? 'justify-center' : 'justify-end lg:absolute lg:top-4 lg:right-4 lg:z-10'
          }`}
        >
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? `Expand ${paneLabel}` : `Collapse ${paneLabel}`}
            aria-expanded={!collapsed}
            className="rounded-md p-1.5 text-clay transition-colors hover:bg-cream hover:text-espresso"
          >
            <PanelRight size={20} strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {!collapsed && <div className="p-4 md:p-6">{pane}</div>}
      </aside>
    </div>
  );
}

// Section label used inside panes: Bold 12, clay, uppercase.
export const PANE_LABEL = 'text-xs font-bold tracking-[0.04em] text-clay uppercase';
