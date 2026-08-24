import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';

export default function ProtectedRoute() {
  const { data, isPending } = useSession();

  if (isPending) {
    return <p className="p-8 text-center text-sm text-slate-500">Loading…</p>;
  }

  return data?.user ? <Outlet /> : <Navigate to="/login" replace />;
}
