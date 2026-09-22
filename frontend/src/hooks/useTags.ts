import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Tag } from '@/types';

export function useTags() {
  const queryClient = useQueryClient();

  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: () => api.get<Tag[]>('/api/tags'),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tags'] });

  const createTag = useMutation({
    mutationFn: (name: string) => api.post<Tag>('/api/tags', { name }),
    onSuccess: invalidate,
  });

  const renameTag = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      api.patch<Tag>(`/api/tags/${id}`, { name }),
    onSuccess: invalidate,
  });

  const deleteTag = useMutation({
    mutationFn: (id: number) => api.delete(`/api/tags/${id}`),
    onSuccess: invalidate,
  });

  return { tagsQuery, createTag, renameTag, deleteTag };
}
