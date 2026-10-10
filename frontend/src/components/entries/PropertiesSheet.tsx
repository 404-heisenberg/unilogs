import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

// Figma "Mobile Entry — Properties Sheet" (24-265): below desktop width the
// editor's properties live in a bottom sheet, opened from a gold-outlined
// "Properties" pill above the title (24-219), instead of stacking under the
// editor.
export default function PropertiesSheet({
  children,
  hasErrors = false,
}: {
  children: ReactNode;
  /** Draws attention to the pill when a field inside needs fixing. */
  hasErrors?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`mb-4 inline-flex min-h-11 items-center gap-1.5 self-start rounded-full border px-4 text-[13px] font-semibold ${
          hasErrors ? 'border-error text-error' : 'border-gold text-clay'
        }`}
      >
        Properties
        {hasErrors && <span className="size-1.5 rounded-full bg-error" aria-hidden />}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex max-h-[70vh] flex-col gap-0 rounded-t-2xl bg-paper p-0"
        >
          <div className="flex justify-center pt-2" aria-hidden>
            <span className="h-1 w-9 rounded-sm bg-explorer" />
          </div>
          <SheetHeader className="flex-row items-center justify-between px-4 py-2">
            <SheetTitle className="text-lg font-bold text-espresso">Properties</SheetTitle>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close properties"
              className="-mr-2 flex size-11 items-center justify-center"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-cream text-clay">
                <X className="size-3.5" strokeWidth={2.5} aria-hidden />
              </span>
            </button>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pt-2 pb-6">{children}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}
