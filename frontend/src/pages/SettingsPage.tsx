import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationsSettings from '@/components/settings/NotificationsSettings';
import TagsSettings from '@/components/settings/TagsSettings';
import { useCalendarConnection } from '@/hooks/useCalendarConnection';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

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
      </div>
    </section>
  );
}

// Settings splits on one axis: "Account" is who you are and what happens to
// your data, "App" is how UniLogs behaves for you. Both halves are per-user
// settings, so the labels are about intent rather than about who stores it.
type SettingsTab = 'account' | 'app';

const SETTINGS_TABS: { id: SettingsTab; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'app', label: 'App' },
];

// App is the default because it holds the settings people actually come back to
// (reminders, integrations, tags) and it keeps the destructive actions in
// "Delete account" off the first screen. The UL mark links straight to
// ?tab=account instead, because it stands for the user rather than the app.
const DEFAULT_TAB: SettingsTab = 'app';

const MUTED = 'text-clay';

function parseSettingsTab(value: string | null): SettingsTab {
  return SETTINGS_TABS.find((tab) => tab.id === value)?.id ?? DEFAULT_TAB;
}

function TabBar({ tab, onChange }: { tab: SettingsTab; onChange: (tab: SettingsTab) => void }) {
  return (
    <div role="tablist" aria-label="Settings sections" className="flex gap-6 border-b border-cream">
      {SETTINGS_TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`tab-${id}`}
          aria-selected={tab === id}
          aria-controls={`panel-${id}`}
          onClick={() => onChange(id)}
          className={`-mb-px min-h-11 flex-1 border-b-2 px-1 pb-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-gold md:min-h-0 md:flex-none ${
            tab === id
              ? 'border-gold font-bold text-espresso'
              : `border-transparent ${MUTED} hover:text-espresso`
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { data } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const tab = parseSettingsTab(searchParams.get('tab'));
  const changeTab = (next: SettingsTab) =>
    setSearchParams(next === DEFAULT_TAB ? {} : { tab: next });

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
    onError: (error) => toast.error(error),
  });

  const handleDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    deleteAccount.mutate({ password });
  };

  return (
    <div className="flex max-w-200 flex-col gap-8">
      <div>
        <h1 className="sr-only text-[28px] font-bold text-espresso md:not-sr-only">Settings</h1>
        <p className="hidden text-sm text-clay md:mt-1.5 md:block">
          {tab === 'account'
            ? 'Your details and your data'
            : 'Notifications, integrations and tags'}
        </p>
      </div>

      <TabBar tab={tab} onChange={changeTab} />

      {tab === 'account' ? (
        <div
          role="tabpanel"
          id="panel-account"
          aria-labelledby="tab-account"
          className="flex flex-col gap-8"
        >
          {data?.user && (
            <section className="flex flex-col gap-3">
              <h2 className="text-[13px] font-bold text-espresso uppercase">Profile</h2>
              <div className="flex items-center gap-3 rounded-xl border border-line bg-paper p-4">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-caramel text-base font-semibold text-white"
                  aria-hidden
                >
                  {initials || '?'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-espresso">
                    {data.user.name}
                  </p>
                  <p className="truncate text-xs text-clay">{data.user.email}</p>
                </div>
              </div>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-[13px] font-bold text-espresso uppercase">Session</h2>
            <div className="rounded-xl border border-line bg-paper p-4">
              <p className="text-sm text-clay">Sign out of UniLogs on this device.</p>
              <Button
                type="button"
                variant="outline"
                onClick={signOut}
                className="mt-3 min-h-11 md:min-h-0"
              >
                Sign out
              </Button>
            </div>
          </section>

          <div className="rounded-xl border border-error/50 bg-danger-soft p-4">
            <h2 className="text-sm font-semibold text-danger-text">Delete account</h2>
            <p className="mt-1 text-sm text-error">
              This permanently deletes your account along with all of your projects and entries.
              This cannot be undone.
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
      ) : (
        <div
          role="tabpanel"
          id="panel-app"
          aria-labelledby="tab-app"
          className="flex flex-col gap-8"
        >
          <NotificationsSettings />

          <GoogleCalendarSection />

          <TagsSettings />
        </div>
      )}
    </div>
  );
}
