import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import Skeleton from '@/components/Skeleton';

export default function ProtectedRoute() {
  const { data, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <Skeleton rows={3} className="w-48" />
      </div>
    );
  }
  return data ? <Outlet /> : <Navigate to="/login" replace />;
}
