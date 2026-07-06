import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client.api';
import type { DiaryDay } from '@/routes/_private/painel/@interface/diary';

export const diaryKeys = {
  all: ['diary'] as const,
  day: (dateISO: string, projectId?: number) => [...diaryKeys.all, dateISO, projectId] as const,
};

export function useDiaryDay(dateISO: string, projectId?: number) {
  return useQuery({
    queryKey: diaryKeys.day(dateISO, projectId),
    queryFn: async () => {
      const response = await api.get<DiaryDay>('/diary', { params: { date: dateISO, projectId } });
      return response.data;
    },
  });
}

function useDiaryAction(path: (id: number) => string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post(path(id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diaryKeys.all }),
  });
}

export function useResolveAlert() {
  return useDiaryAction((id) => `/alerts/${id}/resolve`);
}

export function useAcknowledgeAlert() {
  return useDiaryAction((id) => `/alerts/${id}/acknowledge`);
}

export function useConfirmMention() {
  return useDiaryAction((id) => `/mentions/${id}/confirm`);
}

export function useRejectMention() {
  return useDiaryAction((id) => `/mentions/${id}/reject`);
}
