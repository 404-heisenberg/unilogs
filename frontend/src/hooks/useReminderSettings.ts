import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type ReminderSettings = { remindersEnabled: boolean };

export function useReminderSettings() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['reminder-settings'],
    queryFn: () => api.get<ReminderSettings>('/api/settings'),
  });

  const updateSettings = useMutation({
    mutationFn: (input: ReminderSettings) => api.patch<ReminderSettings>('/api/settings', input),
    onSuccess: (data) => queryClient.setQueryData(['reminder-settings'], data),
  });

  return { settingsQuery, updateSettings };
}
