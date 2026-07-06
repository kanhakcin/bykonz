import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client.api';
import type { Standard, StandardFormData, StandardListResponse } from '@/routes/_private/cadastros/normas/@interface/standard.interface';

export const standardsKeys = {
  all: ['standards'] as const,
  lists: () => [...standardsKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...standardsKeys.lists(), params] as const,
  details: () => [...standardsKeys.all, 'detail'] as const,
  detail: (id: number) => [...standardsKeys.details(), id] as const,
};

export interface StandardListParams {
  search?: string;
  page?: number;
  size?: number;
}

async function fetchStandards(params: StandardListParams): Promise<StandardListResponse> {
  const response = await api.get<StandardListResponse>('/standards', { params });
  return response.data;
}

async function fetchStandard(id: number): Promise<Standard> {
  const response = await api.get<Standard>(`/standards/${id}`);
  return response.data;
}

async function createStandard(data: StandardFormData): Promise<Standard> {
  const response = await api.post<Standard>('/standards', data);
  return response.data;
}

async function updateStandard({ id, ...data }: StandardFormData & { id: number }): Promise<Standard> {
  const response = await api.put<Standard>(`/standards/${id}`, data);
  return response.data;
}

async function deleteStandard(id: number): Promise<void> {
  await api.delete(`/standards/${id}`);
}

export function useStandards(params: StandardListParams) {
  return useQuery({
    queryKey: standardsKeys.list({ ...params }),
    queryFn: () => fetchStandards(params),
    placeholderData: keepPreviousData,
  });
}

export function useStandard(id?: number) {
  return useQuery({
    queryKey: standardsKeys.detail(id ?? 0),
    queryFn: () => fetchStandard(id ?? 0),
    enabled: !!id,
  });
}

export function useStandardsApi() {
  const queryClient = useQueryClient();

  const createStandardMutation = useMutation({
    mutationFn: createStandard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: standardsKeys.lists() });
    },
  });

  const updateStandardMutation = useMutation({
    mutationFn: updateStandard,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: standardsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: standardsKeys.detail(data.id) });
    },
  });

  const deleteStandardMutation = useMutation({
    mutationFn: deleteStandard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: standardsKeys.lists() });
    },
  });

  return {
    createStandard: createStandardMutation,
    updateStandard: updateStandardMutation,
    deleteStandard: deleteStandardMutation,
  };
}
