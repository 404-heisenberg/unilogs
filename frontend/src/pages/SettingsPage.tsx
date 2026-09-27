import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import NotificationsSettings from '@/components/settings/NotificationsSettings';
import TagsSettings from '@/components/settings/TagsSettings';
import { useCalendarConnection } from '@/hooks/useCalendarConnection';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';

function GoogleCalendarSection() {
  const { statusQuery, connect, disconnect } = useCalendarConnection();

  return (
    <div className="rounded-md border border-caramel/40 bg-white p-4">
      <h2 className="text-sm font-semibold text-espresso">Google Calendar</h2>

      {statusQuery.isPending && <p className="mt-1 text-sm text-clay">Checking connection…</p>}

      {statusQuery.isError && (
        <div className="mt-2">
          <p className="text-sm text-error">Couldn&apos;t check the Google Calendar connection.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 min-h-11 md:min-h-0"
            onClick={() => statusQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      )}

      {statusQuery.isSuccess && (
        <div className="mt-2">
          <p className="text-sm text-cocoa">
            {statusQuery.data.connected
              ? 'Your Google Calendar is connected.'
              : 'Your Google Calendar is not connected.'}
          </p>

          {statusQuery.data.connected ? (
            <Button
              type="button"
              variant="outline"
              className="mt-2 min-h-11 md:min-h-0"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          ) : (
            <Button
              type="button"
              className="mt-2 min-h-11 bg-espresso text-cream hover:opacity-90 md:min-h-0"
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
            >
              {connect.isPending ? 'Connecting…' : 'Connect Google Calendar'}
            </Button>
          )}
        </div>
      )}

      {connect.isError && <p className="mt-2 text-sm text-error">{connect.error.message}</p>}
      {disconnect.isError && <p className="mt-2 text-sm text-error">{disconnect.error.message}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const { data } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');

  const deleteAccount = useMutation({
    mutationFn: (input: { password: string }) =>
      api.delete<{ message: string }>('/api/auth/account', input),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['session'] });
      navigate('/', { replace: true });
    },
  });

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    deleteAccount.mutate({ password });
  };

  return (
    <div className="mx-auto flex max-w-200 flex-col gap-8">
      <h1 className="sr-only text-2xl font-bold md:not-sr-only">Settings</h1>

      {data?.user && (
        <div>
          <h2 className="mb-1 text-sm font-semibold">Account</h2>
          <p className="text-sm">{data.user.name}</p>
          <p className="text-sm text-clay">{data.user.email}</p>
        </div>
      )}

      <NotificationsSettings />

      <GoogleCalendarSection />

      <TagsSettings />

      <div className="rounded-md border border-error/50 bg-danger-soft p-4">
        <h2 className="text-sm font-semibold text-danger-text">Delete account</h2>
        <p className="mt-1 text-sm text-error">
          This permanently deletes your account along with all of your projects and entries. This
          cannot be undone.
        </p>

        {!confirming ? (
          <Button
            type="button"
            variant="destructive"
            className="mt-3 min-h-11 md:min-h-0"
            onClick={() => setConfirming(true)}
          >
            Delete account
          </Button>
        ) : (
          <form onSubmit={handleDelete} className="mt-3 flex flex-col gap-3">
            <div>
              <label htmlFor="delete-password" className="block text-sm mb-1 text-danger-text">
                Confirm your password
              </label>
              <input
                id="delete-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="min-h-11 w-full rounded-lg border border-error/50 bg-white px-3 py-2 text-espresso outline-none focus:ring-2 focus:ring-error md:min-h-10"
              />
            </div>

            {deleteAccount.isError && (
              <p className="text-sm text-error">{deleteAccount.error.message}</p>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                variant="destructive"
                className="min-h-11 md:min-h-0"
                disabled={deleteAccount.isPending}
              >
                {deleteAccount.isPending ? 'Deleting…' : 'Permanently delete'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 md:min-h-0"
                onClick={() => {
                  setConfirming(false);
                  setPassword('');
                  deleteAccount.reset();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
