import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';

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
