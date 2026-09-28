import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';

type ShareLinkResponse = { url: string; token: string; expiresAt: string };

type StoredLink = {
  token: string;
  url: string;
  expiresAt: string;
  createdAt: string;
  includeBodies: boolean;
};

const storageKey = (projectId: string) => `unilogs:share-link:${projectId}`;

// The API can't list existing links, so the link created on this device is
// remembered here and dropped once it expires or is revoked.
function loadLink(projectId: string): StoredLink | null {
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLink;
    if (typeof parsed.token !== 'string' || new Date(parsed.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(storageKey(projectId));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveLink(projectId: string, link: StoredLink | null) {
  try {
    if (link) localStorage.setItem(storageKey(projectId), JSON.stringify(link));
    else localStorage.removeItem(storageKey(projectId));
  } catch {
    // storage unavailable - the link just won't be remembered
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
};

export default function ShareDialog({ open, onOpenChange, projectId }: ShareDialogProps) {
  const [link, setLink] = useState<StoredLink | null>(() => loadLink(projectId));
  const [includeBodies, setIncludeBodies] = useState(false);
  const [copied, setCopied] = useState(false);

  const createLink = useMutation({
    mutationFn: () =>
      api.post<ShareLinkResponse>(`/api/projects/${projectId}/share-links`, { includeBodies }),
    onSuccess: (result) => {
      const next: StoredLink = {
        token: result.token,
        // Built here so the link always opens this app's public page.
        url: `${window.location.origin}/r/${result.token}`,
        expiresAt: result.expiresAt,
        createdAt: new Date().toISOString(),
        includeBodies,
      };
      saveLink(projectId, next);
      setLink(next);
    },
  });

  const revokeLink = useMutation({
    mutationFn: (token: string) => api.delete(`/api/projects/${projectId}/share-links/${token}`),
    onSuccess: () => {
      saveLink(projectId, null);
      setLink(null);
      setCopied(false);
    },
  });

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable - the link is still selectable in the field
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="bg-paper text-espresso"
      >
        <DialogTitle>Share report</DialogTitle>

        {link ? (
          <>
            <p className="flex items-center gap-1.5 text-xs text-success">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              Link active — created {formatDate(link.createdAt)}
            </p>

            <div className="flex items-center gap-2 min-h-10 rounded-lg border border-line bg-white px-3 py-2">
              <input
                readOnly
                value={link.url}
                aria-label="Share link"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                aria-label="Copy link"
                onClick={handleCopy}
                className="shrink-0 rounded p-1 text-clay hover:bg-cream"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label htmlFor="share-bodies" className="text-sm">
                Include entry bodies
              </label>
              <Switch id="share-bodies" checked={link.includeBodies} disabled />
            </div>
            <p className="-mt-2 text-xs text-clay">
              {link.includeBodies
                ? 'On — readers also see entry notes.'
                : 'Off — readers see summary stats and properties only.'}{' '}
              This is set when the link is created. Revoke it to change.
            </p>

            {revokeLink.isError && (
              <p role="alert" className="text-xs text-danger">
                {revokeLink.error.message}
              </p>
            )}

            <div className="mt-1 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => revokeLink.mutate(link.token)}
                disabled={revokeLink.isPending}
                className="min-h-11 text-sm font-medium text-danger hover:underline disabled:opacity-50 md:min-h-10"
              >
                {revokeLink.isPending ? 'Revoking…' : 'Revoke link'}
              </button>
              <Button
                type="button"
                size="sm"
                className="min-h-11 bg-espresso text-cream hover:opacity-90 md:min-h-10"
                onClick={handleCopy}
              >
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-cocoa">
              Create a read-only link to a summary of this project. Anyone with the link can view it
              for 30 days, no login needed.
            </p>

            <div className="flex items-center justify-between gap-3">
              <label htmlFor="share-bodies" className="text-sm">
                Include entry bodies
              </label>
              <Switch
                id="share-bodies"
                checked={includeBodies}
                onCheckedChange={setIncludeBodies}
              />
            </div>
            <p className="-mt-2 text-xs text-clay">
              {includeBodies
                ? 'On — readers also see entry notes.'
                : 'Off — readers see summary stats and properties only.'}
            </p>

            {createLink.isError && (
              <p role="alert" className="text-xs text-danger">
                {createLink.error.message}
              </p>
            )}

            <div className="mt-1 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 md:min-h-10"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-11 bg-espresso text-cream hover:opacity-90 md:min-h-10"
                onClick={() => createLink.mutate()}
                disabled={createLink.isPending}
              >
                {createLink.isPending ? 'Creating…' : 'Create link'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
