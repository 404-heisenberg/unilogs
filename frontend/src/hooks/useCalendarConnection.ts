import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type CalendarConnectResult, type CalendarStatus } from '@/lib/api';
import { toast } from '@/lib/toast';

export function useCalendarConnection() {
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
    onError: (error) => toast.error(error),
  });

  const disconnect = useMutation({
    mutationFn: () => api.delete<CalendarStatus>('/api/calendar/disconnect'),
    onSuccess: invalidateStatus,
    onError: (error) => toast.error(error),
  });

  return { statusQuery, connect, disconnect };
}
