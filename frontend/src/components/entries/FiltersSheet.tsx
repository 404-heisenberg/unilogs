import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useTags } from '@/hooks/useTags';
import {
  DATE_RANGE_LABELS,
  DEFAULT_FILTERS,
  type DateRangeKey,
  type EntryFilters,
} from '@/lib/entryFilters';
import type { Project } from '@/types';

const DATE_RANGE_KEYS: DateRangeKey[] = ['all', 'today', '7d', '30d', 'custom'];

// Deterministic project dot colors, same palette as the tags settings dots —
// there's no color field on Project either, this just gives rows a visual
// anchor to scan by, matching the design's colored dots.
const DOT_COLORS = ['#d4a843', '#3e7a52', '#4a6fa5', '#9c5a9c', '#c4664a'];
const dotColorFor = (id: number) => DOT_COLORS[id % DOT_COLORS.length];

export default function FiltersSheet({
  open,
  onOpenChange,
  projects,
  filters,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  filters: EntryFilters;
  onApply: (filters: EntryFilters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  const { tagsQuery } = useTags();
  const tags = tagsQuery.data ?? [];

  // Re-sync the draft to whatever's actually applied every time the sheet
  // opens, so a dismissed (not applied) edit never lingers into next time.
  // Adjusting state during render (React's documented pattern) rather than
  // in an effect, which would cause an extra render pass.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setDraft(filters);
  }

  const toggleTag = (id: number) => {
    setDraft((d) => ({
      ...d,
      tagIds: d.tagIds.includes(id) ? d.tagIds.filter((t) => t !== id) : [...d.tagIds, id],
    }));
  };

  const apply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const reset = () => {
    onApply(DEFAULT_FILTERS);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[85vh] flex-col gap-0 rounded-t-2xl bg-[#fffcf7] p-0"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="px-4 pt-2 pb-1 text-lg font-bold text-[#1c0d05]">
            Filters
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 overflow-y-auto px-4 pt-3 pb-4">
          <input
            type="search"
            value={draft.search}
            onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
            placeholder="Search title, body, or project…"
            aria-label="Search entries"
            className="h-11 w-full rounded-lg border border-[#d4c4b0] bg-white px-3 text-[13px] text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
          />

          <div className="flex flex-col gap-2.5">
            <p className="text-[11px] font-medium tracking-wide text-[#7a5230] uppercase">
              Project
            </p>
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, projectId: null }))}
              className="flex min-h-11 w-full items-center justify-between py-1 text-left"
            >
              <span className="text-[13px] font-semibold text-[#1c0d05]">All projects</span>
              {draft.projectId === null && <span className="text-[#d4a843]">✓</span>}
            </button>
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, projectId: project.id }))}
                className="flex min-h-11 w-full items-center justify-between py-1 text-left"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className="size-[10px] shrink-0 rounded-full"
                    style={{ backgroundColor: dotColorFor(project.id) }}
                    aria-hidden
                  />
                  <span className="text-[13px] font-medium text-[#1c0d05]">{project.name}</span>
                </span>
                {draft.projectId === project.id && <span className="text-[#d4a843]">✓</span>}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            <p className="text-[11px] font-medium tracking-wide text-[#7a5230] uppercase">
              Date range
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DATE_RANGE_KEYS.map((key) => {
                const active = draft.dateRange === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, dateRange: key }))}
                    className={`min-h-11 rounded-lg px-3 text-[11px] font-semibold ${
                      active
                        ? 'bg-[#d4a843] text-[#1c0d05]'
                        : 'border border-[#d4c4b0] text-[#1c0d05]'
                    }`}
                  >
                    {DATE_RANGE_LABELS[key]}
                  </button>
                );
              })}
            </div>
            {draft.dateRange === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={draft.customFrom}
                  onChange={(e) => setDraft((d) => ({ ...d, customFrom: e.target.value }))}
                  aria-label="From date"
                  className="min-h-11 flex-1 rounded-lg border border-[#d4c4b0] bg-white px-2 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
                />
                <span className="text-sm text-[#7a5230]">to</span>
                <input
                  type="date"
                  value={draft.customTo}
                  onChange={(e) => setDraft((d) => ({ ...d, customTo: e.target.value }))}
                  aria-label="To date"
                  className="min-h-11 flex-1 rounded-lg border border-[#d4c4b0] bg-white px-2 text-sm text-[#1c0d06] outline-none focus:ring-2 focus:ring-[#1c0d06]"
                />
              </div>
            )}
          </div>

          {tags.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <p className="text-[11px] font-medium tracking-wide text-[#7a5230] uppercase">Tags</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const active = draft.tagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold ${
                        active
                          ? 'bg-[#d4a843] text-[#1c0d05]'
                          : 'border border-[#d4c4b0] text-[#1c0d05]'
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[#f0e7db] px-4 py-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 px-2 text-[13px] font-semibold text-[#7a5230]"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={apply}
            className="min-h-11 rounded-lg bg-[#d4a843] px-5 text-[13px] font-semibold text-[#1c0d05]"
          >
            Apply filters
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
