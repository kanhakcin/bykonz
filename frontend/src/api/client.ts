/**
 * Ponto único de acesso a dados + hooks TanStack Query.
 * Com VITE_API_URL definido usa a API real (http.ts); sem ele, o mock.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { httpApi } from './http'
import { mockApi } from './mock'
import type { DiaryApi } from './types'

export const api: DiaryApi = import.meta.env.VITE_API_URL ? httpApi : mockApi

const diaryKey = (dateISO: string) => ['diary', dateISO] as const

export function useDiaryDay(dateISO: string) {
  return useQuery({
    queryKey: diaryKey(dateISO),
    queryFn: () => api.getDiaryDay(dateISO),
  })
}

function useDiaryAction<TArg>(action: (arg: TArg) => Promise<void>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: action,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['diary'] }),
  })
}

export function useResolveAlert() {
  return useDiaryAction((id: number) => api.resolveAlert(id))
}

export function useAcknowledgeAlert() {
  return useDiaryAction((id: number) => api.acknowledgeAlert(id))
}

export function useConfirmMention() {
  return useDiaryAction((id: number) => api.confirmMention(id))
}

export function useRejectMention() {
  return useDiaryAction((id: number) => api.rejectMention(id))
}
