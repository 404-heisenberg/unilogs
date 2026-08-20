import { Navigate, Outlet } from 'react-router-dom';

function useIsLoggedIn() {
  return false; // replace with real check once auth exists
}

export default function ProtectedRoute() {
  const isLoggedIn = useIsLoggedIn();
  return isLoggedIn ? <Outlet /> : <Navigate to="/login" />;
}
