import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import {
  AGGREGATION_OPTIONS,
  entryWord,
  formatStatValue,
  useStatPanelMutations,
  useStatPanels,
} from '@/lib/stat-panels';
import type { FieldDefinition, StatPanel, StatPanelPoint } from '@/types';

const CARD = 'rounded-xl border border-cream bg-paper';
const MUTED = 'text-clay';
const MENU_ITEM =
  'flex min-h-11 w-full items-center px-4 text-left text-[13px] text-rail hover:bg-cream focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold md:min-h-8';

// Figma 21:5's panel "sparkline": a 6px strip of gold 24px segments, one per
// day in the range that has a value.
function Sparkline({ series }: { series: StatPanelPoint[] }) {
  if (series.length === 0) return null;
  return (
    <div
      className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-[3px]"
      role="img"
      aria-label={`${series.length} ${series.length === 1 ? 'day' : 'days'} with data in the range`}
    >
      {series.map((point) => (
        <span key={point.date} className="h-full w-6 shrink-0 rounded-[2px] bg-gold" />
      ))}
    </div>
  );
}

type MenuProps = {
  panelName: string;
  hidden: boolean;
  removing: boolean;
  onEdit: () => void;
  onToggleHidden: () => void;
  onRemove: () => void;
};

function OverflowMenu({
  panelName,
  hidden,
  removing,
  onEdit,
  onToggleHidden,
  onRemove,
}: MenuProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setConfirming(false);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setConfirming(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`More actions for ${panelName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="-m-2 flex size-9 items-center justify-center rounded-lg text-cocoa hover:bg-cream focus-visible:outline-2 focus-visible:outline-gold"
      >
        <MoreHorizontal className="size-4.5" strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 min-w-[140px] overflow-hidden rounded-lg border border-line bg-white py-1.5 shadow-[0px_4px_12px_0px_rgba(0,0,0,0.12)]"
        >
          {confirming ? (
            <div className="p-3">
              <p className="text-sm text-espresso">Remove this panel?</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={removing}
                  onClick={() => {
                    onRemove();
                    close();
                  }}
                  className="min-h-9 flex-1 rounded-lg bg-danger-soft px-2 text-[13px] font-medium text-danger-text hover:opacity-90"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="min-h-9 flex-1 rounded-lg border border-line px-2 text-[13px] text-espresso hover:bg-cream"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className={MENU_ITEM}
                onClick={() => {
                  close();
                  onEdit();
                }}
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                className={MENU_ITEM}
                onClick={() => {
                  close();
                  onToggleHidden();
                }}
              >
                {hidden ? 'Unhide' : 'Hide'}
              </button>
              <button
                type="button"
                role="menuitem"
                className={`${MENU_ITEM} text-error`}
                onClick={() => setConfirming(true)}
              >
                Remove
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type CardProps = {
  panel: StatPanel;
  fields: FieldDefinition[];
  removing: boolean;
  onEdit: () => void;
  onToggleHidden: () => void;
  onRemove: () => void;
};

export function StatPanelCard({
  panel,
  fields,
  removing,
  onEdit,
  onToggleHidden,
  onRemove,
}: CardProps) {
  const aggregationLabel =
    AGGREGATION_OPTIONS.find((option) => option.value === panel.aggregation)?.label ??
    panel.aggregation;
  const hasValue = panel.value !== null && panel.sampleCount > 0;

  return (
    <li className={`${CARD} flex flex-col gap-2 p-3.5 ${panel.hidden ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p
          title={panel.expression}
          className={`truncate text-[11px] font-bold tracking-[0.44px] uppercase ${MUTED}`}
        >
          {panel.name}
        </p>
        <OverflowMenu
          panelName={panel.name}
          hidden={panel.hidden}
          removing={removing}
          onEdit={onEdit}
          onToggleHidden={onToggleHidden}
          onRemove={onRemove}
        />
      </div>

      {panel.error ? (
        <p role="alert" className="text-sm text-error">
          Couldn’t calculate this panel: {panel.error}
        </p>
      ) : hasValue ? (
        <>
          <p className="truncate text-2xl font-bold text-espresso">
            ≈ {formatStatValue(panel.value as number, panel.expression, fields)}
          </p>
          <p className="text-[11px] text-cocoa">
            {aggregationLabel} · Last {panel.rangeDays} days · {entryWord(panel.sampleCount)}
          </p>
          <Sparkline series={panel.series} />
        </>
      ) : (
        <p className={`text-sm ${MUTED}`}>No data yet</p>
      )}
    </li>
  );
}

type SectionProps = {
  projectId: string;
  fields: FieldDefinition[];
  onEdit: (panel: StatPanel) => void;
};

export function SavedStatPanels({ projectId, fields, onEdit }: SectionProps) {
  const panels = useStatPanels(projectId);
  const { remove, update } = useStatPanelMutations(projectId);
  const [showHidden, setShowHidden] = useState(false);

  const all = panels.data ?? [];
  const hiddenCount = all.filter((panel) => panel.hidden).length;
  const visible = showHidden ? all : all.filter((panel) => !panel.hidden);

  return (
    <section aria-labelledby="saved-panels-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="saved-panels-heading" className="text-base font-bold text-espresso">
          Saved stat panels
        </h2>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowHidden((value) => !value)}
            className="rounded px-1.5 py-0.5 text-xs font-medium text-cocoa hover:text-espresso hover:underline focus-visible:outline-2 focus-visible:outline-gold"
          >
            {showHidden ? 'Hide hidden panels' : `Show ${hiddenCount} hidden`}
          </button>
        )}
      </div>

      {panels.isPending && panels.fetchStatus !== 'idle' && (
        <div aria-busy className="h-24 animate-pulse rounded-xl bg-cream/60" />
      )}
      {panels.isError && <p className={`text-sm ${MUTED}`}>Couldn’t load saved panels.</p>}
      {panels.isSuccess && all.length === 0 && (
        <p className={`text-sm ${MUTED}`}>
          No stat panels yet. Use “Add stat panel” above to build your first one.
        </p>
      )}
      {visible.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
          {visible.map((panel) => (
            <StatPanelCard
              key={panel.id}
              panel={panel}
              fields={fields}
              removing={remove.isPending && remove.variables === panel.id}
              onEdit={() => onEdit(panel)}
              onToggleHidden={() => update.mutate({ id: panel.id, hidden: !panel.hidden })}
              onRemove={() => remove.mutate(panel.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
