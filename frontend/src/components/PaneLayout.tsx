import type { ReactNode } from 'react';

// Figma's workspace layout: the page content, plus a full-height 288px pane
// on the right (Properties / Metadata) with a cream left border. The wrapper
// cancels AppShell's <main> padding so the pane reaches the top and right
// edges, then re-applies it to the content column. Below lg the pane stacks
// under the content.
export default function PaneLayout({
  children,
  pane,
  paneLabel,
}: {
  children: ReactNode;
  pane: ReactNode;
  paneLabel: string;
}) {
  return (
    <div className="-m-4 flex min-h-[calc(100%+2rem)] flex-col md:-m-12 md:min-h-[calc(100%+6rem)] lg:flex-row">
      <div className="min-w-0 flex-1 p-4 md:p-12">{children}</div>
      <aside
        aria-label={paneLabel}
        className="border-t border-cream bg-paper p-4 md:p-6 lg:w-72 lg:shrink-0 lg:border-t-0 lg:border-l"
      >
        {pane}
      </aside>
    </div>
  );
}

// Section label used inside panes: Bold 12, clay, uppercase.
export const PANE_LABEL = 'text-xs font-bold tracking-[0.04em] text-clay uppercase';
