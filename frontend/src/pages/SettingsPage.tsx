import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationsSettings from '@/components/settings/NotificationsSettings';
import TagsSettings from '@/components/settings/TagsSettings';
import { useCalendarConnection } from '@/hooks/useCalendarConnection';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';

function GoogleCalendarSection() {
  const { statusQuery, connect, disconnect } = useCalendarConnection();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] font-bold text-espresso uppercase">Integrations</h2>
      <div className="rounded-xl border border-line bg-paper p-4">
        <div className="flex items-center gap-3">
          <Calendar className="size-5 shrink-0 text-cocoa" strokeWidth={1.75} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-espresso">Google Calendar</p>
            {statusQuery.isSuccess && (
              <p
                className={`flex items-center gap-1.5 text-xs ${statusQuery.data.connected ? 'text-success' : 'text-clay'}`}
              >
                <span
                  className={`size-1.5 rounded-full ${statusQuery.data.connected ? 'bg-success' : 'bg-line-strong'}`}
                  aria-hidden
                />
                {statusQuery.data.connected ? 'Connected' : 'Not connected'}
              </p>
            )}
          </div>
          {statusQuery.isSuccess &&
            (statusQuery.data.connected ? (
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-lg border border-line px-4 text-[13px] font-semibold text-espresso transition-colors hover:bg-cream disabled:opacity-50 md:min-h-8"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
              >
                {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
              </button>
            ) : (
              <button
                type="button"
                className="min-h-11 shrink-0 rounded-lg bg-espresso px-4 text-[13px] font-semibold text-cream transition-opacity hover:opacity-90 disabled:opacity-50 md:min-h-8"
                onClick={() => connect.mutate()}
                disabled={connect.isPending}
                aria-label="Connect Google Calendar"
              >
                {connect.isPending ? 'Connecting…' : 'Connect'}
              </button>
            ))}
        </div>

        {statusQuery.isPending && <p className="mt-1 text-sm text-clay">Checking connection…</p>}

        {statusQuery.isError && (
          <div className="mt-2">
            <p className="text-sm text-error">
              Couldn&apos;t check the Google Calendar connection.
            </p>
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

        {connect.isError && <p className="mt-2 text-sm text-error">{connect.error.message}</p>}
        {disconnect.isError && (
          <p className="mt-2 text-sm text-error">{disconnect.error.message}</p>
        )}
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const { data } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');

  const signOut = async () => {
    await api.post('/api/auth/sign-out');
    queryClient.removeQueries({ queryKey: ['session'] });
    navigate('/login');
  };

  const initials = (data?.user.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

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
    <div className="flex max-w-200 flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="sr-only text-[28px] font-bold text-espresso md:not-sr-only">Settings</h1>
          <p className="hidden text-sm text-clay md:mt-1.5 md:block">
            Manage your account and configurations
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="ml-auto min-h-11 shrink-0 rounded-lg border border-line px-4 text-[13px] font-semibold text-espresso transition-colors hover:bg-cream md:min-h-9"
        >
          Sign out
        </button>
      </div>

      {data?.user && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[13px] font-bold text-espresso uppercase">Account</h2>
          <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-4">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-caramel text-base font-semibold text-white"
              aria-hidden
            >
              {initials || '?'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-espresso">{data.user.name}</p>
              <p className="truncate text-xs text-clay">{data.user.email}</p>
            </div>
          </div>
        </section>
      )}

      <NotificationsSettings />

      <GoogleCalendarSection />

      <TagsSettings />

      <div className="rounded-xl border border-error/50 bg-danger-soft p-4">
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
