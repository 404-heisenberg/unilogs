import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/useSession';
import { api } from '@/lib/api';

export default function AppShell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useSession();

  const handleSignOut = async () => {
    await api.post('/api/auth/sign-out');
    queryClient.removeQueries({ queryKey: ['session'] });
    navigate('/login');
  };

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r p-4 flex flex-col justify-between">
        <nav className="flex flex-col gap-2">
          <Link to="/projects">Projects</Link>
          <Link to="/projects/new">New Project</Link>
          <Link to="/entries">Entries</Link>
          <Link to="/entries/new">New Entry</Link>
        </nav>

        <div className="border-t pt-4">
          {data?.user && (
            <div className="mb-2 text-sm">
              <p className="font-medium">{data.user.name}</p>
              <p className="text-gray-500 text-xs">{data.user.email}</p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="text-left text-sm text-red-700 hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
