import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const DAY_MS = 86_400_000;

type Format = 'csv' | 'md';
type Range = 'all' | '30' | 'custom';

type SegmentedProps<T extends string> = {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
};

function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex overflow-hidden rounded-md border border-[#d4a373]/50 bg-white"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-9 flex-1 px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#D4A843] ${
              selected ? 'bg-[#1c0d06] text-[#f5ebe0]' : 'text-[#1c0d06] hover:bg-[#f5ebe0]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// The backend defaults to the last 30 days when dateFrom is missing, so
// "All time" has to ask for an early start date explicitly.
function exportUrl(projectId: string, format: Format, range: Range, from: string, to: string) {
  const params = new URLSearchParams({ projectId, format, includeBodies: 'true' });
  if (range === 'all') params.set('dateFrom', '1970-01-01');
  if (range === '30') params.set('dateFrom', isoDay(new Date(Date.now() - 30 * DAY_MS)));
  if (range === 'custom') {
    params.set('dateFrom', from);
    params.set('dateTo', to);
  }
  return `${BASE_URL}/api/export?${params.toString()}`;
}

type ExportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
};

export default function ExportDialog({ open, onOpenChange, projectId }: ExportDialogProps) {
  const [format, setFormat] = useState<Format>('csv');
  const [range, setRange] = useState<Range>('30');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const customInvalid = range === 'custom' && (!from || !to || from > to);

  // A plain link to the export endpoint lets the browser stream the file to
  // disk instead of buffering it in memory first.
  const handleExport = () => {
    const link = document.createElement('a');
    link.href = exportUrl(projectId, format, range, from, to);
    link.download = '';
    document.body.appendChild(link);
    link.click();
    link.remove();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="max-w-sm bg-[#FFFCF7] text-[#1c0d06]"
      >
        <DialogTitle className="text-sm">Export entries</DialogTitle>

        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-[#4a3525]">Format</p>
          <Segmented
            label="Format"
            value={format}
            onChange={setFormat}
            options={[
              { value: 'csv', label: 'CSV' },
              { value: 'md', label: 'Markdown' },
            ]}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-[#4a3525]">Range</p>
          <Segmented
            label="Range"
            value={range}
            onChange={setRange}
            options={[
              { value: 'all', label: 'All time' },
              { value: '30', label: 'Last 30 days' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          {range === 'custom' && (
            <div className="mt-1 flex items-center gap-2">
              <input
                type="date"
                aria-label="From date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                className="min-h-9 min-w-0 flex-1 rounded-md border border-[#d4a373]/60 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-[#1c0d06]"
              />
              <span className="text-xs text-[#7a5230]">to</span>
              <input
                type="date"
                aria-label="To date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="min-h-9 min-w-0 flex-1 rounded-md border border-[#d4a373]/60 bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-[#1c0d06]"
              />
            </div>
          )}
          <p className="text-[10px] text-[#7a5230]">Includes all custom fields and notes.</p>
        </div>

        <div className="mt-1 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 md:min-h-0"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="min-h-11 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90 md:min-h-0"
            onClick={handleExport}
            disabled={customInvalid}
          >
            Export
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
