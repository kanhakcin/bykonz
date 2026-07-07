import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client.api';
import type { PanelUser, PanelUserFormData, PanelUserListResponse } from '@/routes/_private/cadastros/usuarios/@interface/panel-user.interface';

export const panelUsersKeys = {
  all: ['panel-users'] as const,
  lists: () => [...panelUsersKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...panelUsersKeys.lists(), params] as const,
  details: () => [...panelUsersKeys.all, 'detail'] as const,
  detail: (id: number) => [...panelUsersKeys.details(), id] as const,
};

export interface PanelUserListParams {
  search?: string;
  page?: number;
  size?: number;
}

async function fetchPanelUsers(params: PanelUserListParams): Promise<PanelUserListResponse> {
  const response = await api.get<PanelUserListResponse>('/users', { params });
  return response.data;
}

async function fetchPanelUser(id: number): Promise<PanelUser> {
  const response = await api.get<PanelUser>(`/users/${id}`);
  return response.data;
}

async function createPanelUser(data: PanelUserFormData): Promise<PanelUser> {
  const response = await api.post<PanelUser>('/users', data);
  return response.data;
}

async function updatePanelUser({ id, ...data }: PanelUserFormData & { id: number }): Promise<PanelUser> {
  const response = await api.put<PanelUser>(`/users/${id}`, data);
  return response.data;
}

async function deletePanelUser(id: number): Promise<void> {
  await api.delete(`/users/${id}`);
}

export function usePanelUsers(params: PanelUserListParams) {
  return useQuery({
    queryKey: panelUsersKeys.list({ ...params }),
    queryFn: () => fetchPanelUsers(params),
    placeholderData: keepPreviousData,
  });
}

export function usePanelUser(id?: number) {
  return useQuery({
    queryKey: panelUsersKeys.detail(id ?? 0),
    queryFn: () => fetchPanelUser(id ?? 0),
    enabled: !!id,
  });
}

export function usePanelUsersApi() {
  const queryClient = useQueryClient();

  const invalidate = (id?: number) => {
    queryClient.invalidateQueries({ queryKey: panelUsersKeys.all });
    if (id) {
      queryClient.invalidateQueries({ queryKey: panelUsersKeys.detail(id) });
    }
  };

  const createPanelUserMutation = useMutation({
    mutationFn: createPanelUser,
    onSuccess: () => invalidate(),
  });

  const updatePanelUserMutation = useMutation({
    mutationFn: updatePanelUser,
    onSuccess: (data) => invalidate(data.id),
  });

  const deletePanelUserMutation = useMutation({
    mutationFn: deletePanelUser,
    onSuccess: () => invalidate(),
  });

  return {
    createPanelUser: createPanelUserMutation,
    updatePanelUser: updatePanelUserMutation,
    deletePanelUser: deletePanelUserMutation,
  };
}
