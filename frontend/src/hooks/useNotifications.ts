import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { NotificationFeed } from '@/types';

const POLL_INTERVAL = 60 * 1000;

export function useNotifications() {
  const queryClient = useQueryClient();

  const feedQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<NotificationFeed>('/api/notifications'),
    refetchInterval: POLL_INTERVAL,
    // Falls back to an empty feed rather than blocking the shell if Block C
    // (the scheduler/feed) is ever unavailable — see the D-09 cut note.
    placeholderData: (previous) => previous,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markRead = useMutation({
    mutationFn: (id: number) => api.post(`/api/notifications/${id}/read`),
    onSuccess: invalidate,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post<{ updated: number }>('/api/notifications/read-all'),
    onSuccess: invalidate,
  });

  return { feedQuery, markRead, markAllRead };
}
