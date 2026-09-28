import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';

export default function ProtectedRoute() {
  const { data, isPending } = useSession();

  if (isPending) {
    return <p className="p-8 text-center text-sm text-clay">Loading…</p>;
  }
  return data ? <Outlet /> : <Navigate to="/login" replace />;
}
