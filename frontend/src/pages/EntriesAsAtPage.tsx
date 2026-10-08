import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, ChevronDown, CircleAlert, Info } from 'lucide-react';
import EntryCard from '@/components/entries/EntryCard';
import Skeleton from '@/components/Skeleton';
import { getEntriesAsAt } from '@/lib/api';
import type { AsAtEntry } from '@/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `2026-09-08` → `8 Sep 2026`, as in Figma. */
function formatDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return `${date} ${MONTHS[month - 1]} ${year}`;
}

export default function EntriesAsAtPage() {
  const today = localDay(new Date());
  // The date lives in the URL so a refresh, or the browser's back button,
  // keeps the day being viewed.
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('date');
  const date = requested && ISO_DAY.test(requested) ? requested : today;
  const dateLabel = formatDay(date);

  // Keyed by date alone, so each day picked is one request and revisiting a
  // day is served from cache.
  const { data, isPending, isError } = useQuery({
    queryKey: ['entries', 'as-at', date],
    queryFn: () => getEntriesAsAt(date),
  });

  const groups = useMemo(() => {
    const map = new Map<string, AsAtEntry[]>();
    for (const entry of data?.entries ?? []) {
      // `date` is stored as midnight UTC, so its first ten characters are the
      // day itself; converting to local time could shift it by one.
      const day = entry.date.slice(0, 10);
      const bucket = map.get(day);
      if (bucket) bucket.push(entry);
      else map.set(day, [entry]);
    }
    return Array.from(map.entries());
  }, [data]);

  const pickDate = (value: string) => {
    // Clearing the native input gives '', which isn't a day to show.
    if (ISO_DAY.test(value)) setSearchParams({ date: value }, { replace: true });
  };

  return (
    <div className="flex flex-col md:gap-2">
      {/* Mobile gets its back arrow and title from the app header. */}
      <div className="flex flex-col gap-1.5">
        <nav
          aria-label="Breadcrumb"
          className="hidden items-center gap-2 text-sm text-clay md:flex"
        >
          <Link to="/entries" className="font-medium hover:underline">
            Entries
          </Link>
          <span aria-hidden>/</span>
          <span className="font-bold text-espresso" aria-current="page">
            As at
          </span>
        </nav>
        <h1 className="sr-only text-[28px] font-bold text-espresso md:not-sr-only">
          Reconstructed Timeline
        </h1>
      </div>

      <div className="-mx-4 -mt-4 flex items-center justify-between gap-4 border-b border-cream bg-paper px-4 py-3 md:m-0 md:border-0 md:bg-transparent md:p-0">
        <label className="relative inline-flex h-11 items-center gap-2 rounded-full border border-line px-3.5 text-sm font-semibold text-clay focus-within:ring-2 focus-within:ring-espresso md:h-auto md:bg-paper md:px-4 md:py-2 md:font-bold">
          <Calendar className="size-3.5" strokeWidth={2} aria-hidden />
          <span>{dateLabel}</span>
          <ChevronDown className="size-3.5 md:size-2.5" strokeWidth={2} aria-hidden />
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => pickDate(e.target.value)}
            // A click anywhere on the pill opens the picker, not just on the
            // browser's own calendar glyph. Not every browser has showPicker.
            onClick={(e) => e.currentTarget.showPicker?.()}
            aria-label="Show the logbook as it stood on"
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <Link
          to="/entries"
          className="hidden h-10 items-center rounded-full bg-gold px-4.5 text-sm font-semibold text-rail transition-opacity hover:opacity-90 md:inline-flex"
        >
          Back to current entries
        </Link>
      </div>

      <p
        role="status"
        className="-mx-4 flex items-center gap-2.5 border-b border-cream bg-cream px-4 py-3 text-[13px] font-medium text-clay md:mx-0 md:rounded-lg md:border-0 md:py-2.5 md:text-sm"
      >
        <Info className="size-4 shrink-0 md:hidden" strokeWidth={1.75} aria-hidden />
        <CircleAlert className="hidden size-3.5 shrink-0 md:block" strokeWidth={1.75} aria-hidden />
        Viewing your logbook as it stood on {dateLabel}
      </p>

      <div className="mt-4">
        {isPending && (
          <div className="grid gap-2 md:grid-cols-2 md:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} rows={1} barClassName="h-28 rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-danger-soft bg-danger-soft p-4 text-sm text-error">
            Failed to load your logbook for {dateLabel}. Try another date or refresh the page.
          </div>
        )}

        {data && data.entries.length === 0 && (
          <div className="rounded-xl border border-dashed border-line-strong bg-paper p-10 text-center">
            <p className="text-sm text-cocoa">Nothing had been logged by {dateLabel}.</p>
          </div>
        )}

        {data && data.entries.length > 0 && (
          <div className="flex flex-col gap-5 md:gap-6">
            {groups.map(([day, dayEntries]) => (
              <section key={day} className="flex flex-col gap-2 md:gap-3">
                <h2 className="text-[13px] font-bold text-espresso md:text-sm">{formatDay(day)}</h2>
                <ul className="grid gap-2 md:grid-cols-2 md:gap-4">
                  {dayEntries.map((entry, index) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      projectName={entry.project.name}
                      readOnly
                      // A day's odd last card spans both columns, as on the
                      // live timeline.
                      wide={index === dayEntries.length - 1 && dayEntries.length % 2 === 1}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
