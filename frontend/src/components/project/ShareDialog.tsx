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
        className="max-w-sm bg-[#FFFCF7] text-[#1c0d06]"
      >
        <DialogTitle className="text-sm">Share report</DialogTitle>

        {link ? (
          <>
            <p className="flex items-center gap-1.5 text-[11px] text-[#3E7A52]">
              <span className="size-1.5 rounded-full bg-[#3E7A52]" aria-hidden />
              Link active — created {formatDate(link.createdAt)}
            </p>

            <div className="flex items-center gap-2 rounded-md border border-[#d4a373]/60 bg-white px-3 py-2">
              <input
                readOnly
                value={link.url}
                aria-label="Share link"
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
              <button
                type="button"
                aria-label="Copy link"
                onClick={handleCopy}
                className="shrink-0 rounded p-1 text-[#7a5230] hover:bg-[#F5EBE0]"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label htmlFor="share-bodies" className="text-xs">
                Include entry bodies
              </label>
              <Switch id="share-bodies" checked={link.includeBodies} disabled />
            </div>
            <p className="-mt-2 text-[10px] text-[#9b5a2a]">
              {link.includeBodies
                ? 'On — readers also see entry notes.'
                : 'Off — readers see summary stats and properties only.'}{' '}
              This is set when the link is created. Revoke it to change.
            </p>

            {revokeLink.isError && (
              <p role="alert" className="text-xs text-[#9b2c2c]">
                {revokeLink.error.message}
              </p>
            )}

            <div className="mt-1 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => revokeLink.mutate(link.token)}
                disabled={revokeLink.isPending}
                className="min-h-11 text-xs font-medium text-[#9b2c2c] hover:underline disabled:opacity-50 md:min-h-0"
              >
                {revokeLink.isPending ? 'Revoking…' : 'Revoke link'}
              </button>
              <Button
                type="button"
                size="sm"
                className="min-h-11 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90 md:min-h-0"
                onClick={handleCopy}
              >
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-[#4a3525]">
              Create a read-only link to a summary of this project. Anyone with the link can view it
              for 30 days, no login needed.
            </p>

            <div className="flex items-center justify-between gap-3">
              <label htmlFor="share-bodies" className="text-xs">
                Include entry bodies
              </label>
              <Switch
                id="share-bodies"
                checked={includeBodies}
                onCheckedChange={setIncludeBodies}
              />
            </div>
            <p className="-mt-2 text-[10px] text-[#9b5a2a]">
              {includeBodies
                ? 'On — readers also see entry notes.'
                : 'Off — readers see summary stats and properties only.'}
            </p>

            {createLink.isError && (
              <p role="alert" className="text-xs text-[#9b2c2c]">
                {createLink.error.message}
              </p>
            )}

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
