import { Download, X } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

export default function InstallPrompt() {
  const { canInstall, promptToInstall, dismiss } = useInstallPrompt();

  if (!canInstall) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gold/20 bg-cream px-4 py-2 md:px-6">
      <p className="text-sm text-espresso">
        <span className="font-semibold">Install UniLogs</span> for quick access from your home
        screen.
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={promptToInstall}
          className="flex min-h-11 items-center gap-1.5 rounded-md bg-espresso px-3 text-sm font-semibold text-cream hover:opacity-90 md:min-h-0"
        >
          <Download size={14} strokeWidth={1.75} />
          Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-clay hover:bg-black/5 md:size-9"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
