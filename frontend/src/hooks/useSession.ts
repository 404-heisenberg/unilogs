import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

type SessionResponse = {
  session: unknown;
  user: SessionUser;
};

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<SessionResponse | null>('/api/auth/get-session'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
