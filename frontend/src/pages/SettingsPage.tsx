import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';

type CalendarStatus = { connected: boolean };
type CalendarConnectResult = { url?: string; connected?: boolean };

function GoogleCalendarSection() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['calendar-status'],
    queryFn: () => api.get<CalendarStatus>('/api/calendar/status'),
  });

  const invalidateStatus = () => queryClient.invalidateQueries({ queryKey: ['calendar-status'] });

  const connect = useMutation({
    mutationFn: () => api.post<CalendarConnectResult>('/api/calendar/connect'),
    onSuccess: (result) => {
      // The backend returns a Google consent URL to redirect to; if the
      // account is already connected it just confirms that instead.
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      invalidateStatus();
    },
  });

  const disconnect = useMutation({
    mutationFn: () => api.delete<CalendarStatus>('/api/calendar/disconnect'),
    onSuccess: invalidateStatus,
  });

  return (
    <div className="mb-8 rounded-md border border-[#d4a373]/40 bg-white p-4">
      <h2 className="text-sm font-semibold text-[#1c0d06]">Google Calendar</h2>

      {statusQuery.isPending && <p className="mt-1 text-sm text-[#7a5230]">Checking connection…</p>}

      {statusQuery.isError && (
        <div className="mt-2">
          <p className="text-sm text-red-700">
            Couldn&apos;t check the Google Calendar connection.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => statusQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      )}

      {statusQuery.isSuccess && (
        <div className="mt-2">
          <p className="text-sm text-[#4a3525]">
            {statusQuery.data.connected
              ? 'Your Google Calendar is connected.'
              : 'Your Google Calendar is not connected.'}
          </p>

          {statusQuery.data.connected ? (
            <Button
              type="button"
              variant="outline"
              className="mt-2"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          ) : (
            <Button
              type="button"
              className="mt-2 bg-[#1c0d06] text-[#f5ebe0] hover:opacity-90"
              onClick={() => connect.mutate()}
              disabled={connect.isPending}
            >
              {connect.isPending ? 'Connecting…' : 'Connect Google Calendar'}
            </Button>
          )}
        </div>
      )}

      {connect.isError && <p className="mt-2 text-sm text-red-700">{connect.error.message}</p>}
      {disconnect.isError && (
        <p className="mt-2 text-sm text-red-700">{disconnect.error.message}</p>
      )}
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
    <div className="max-w-md">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>

      {data?.user && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold mb-1">Account</h2>
          <p className="text-sm">{data.user.name}</p>
          <p className="text-sm text-[#7a5230]">{data.user.email}</p>
        </div>
      )}

      <GoogleCalendarSection />

      <div className="rounded-md border border-red-300 bg-red-50 p-4">
        <h2 className="text-sm font-semibold text-red-800">Delete account</h2>
        <p className="mt-1 text-sm text-red-700">
          This permanently deletes your account along with all of your projects and entries. This
          cannot be undone.
        </p>

        {!confirming ? (
          <Button
            type="button"
            variant="destructive"
            className="mt-3"
            onClick={() => setConfirming(true)}
          >
            Delete account
          </Button>
        ) : (
          <form onSubmit={handleDelete} className="mt-3 flex flex-col gap-3">
            <div>
              <label htmlFor="delete-password" className="block text-sm mb-1 text-red-800">
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
                className="w-full rounded border border-red-300 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {deleteAccount.isError && (
              <p className="text-sm text-red-700">{deleteAccount.error.message}</p>
            )}

            <div className="flex gap-2">
              <Button type="submit" variant="destructive" disabled={deleteAccount.isPending}>
                {deleteAccount.isPending ? 'Deleting…' : 'Permanently delete'}
              </Button>
              <Button
                type="button"
                variant="outline"
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
