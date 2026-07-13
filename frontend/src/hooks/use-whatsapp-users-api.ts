import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client.api';
import type { CompanyRef, WhatsappUser, WhatsappUserFormData, WhatsappUserListResponse } from '@/routes/_private/cadastros/usuarios/@interface/whatsapp-user.interface';

export const whatsappUsersKeys = {
  all: ['whatsapp-users'] as const,
  lists: () => [...whatsappUsersKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...whatsappUsersKeys.lists(), params] as const,
  details: () => [...whatsappUsersKeys.all, 'detail'] as const,
  detail: (id: number) => [...whatsappUsersKeys.details(), id] as const,
  companies: ['companies'] as const,
};

export interface WhatsappUserListParams {
  search?: string;
  page?: number;
  size?: number;
}

async function fetchWhatsappUsers(params: WhatsappUserListParams): Promise<WhatsappUserListResponse> {
  const response = await api.get<WhatsappUserListResponse>('/whatsapp-users', { params });
  return response.data;
}

async function fetchWhatsappUser(id: number): Promise<WhatsappUser> {
  const response = await api.get<WhatsappUser>(`/whatsapp-users/${id}`);
  return response.data;
}

async function createWhatsappUser(data: WhatsappUserFormData): Promise<WhatsappUser> {
  const response = await api.post<WhatsappUser>('/whatsapp-users', data);
  return response.data;
}

async function updateWhatsappUser({ id, ...data }: WhatsappUserFormData & { id: number }): Promise<WhatsappUser> {
  const response = await api.put<WhatsappUser>(`/whatsapp-users/${id}`, data);
  return response.data;
}

async function deleteWhatsappUser(id: number): Promise<void> {
  await api.delete(`/whatsapp-users/${id}`);
}

async function fetchCompanies(): Promise<CompanyRef[]> {
  const response = await api.get<CompanyRef[]>('/companies');
  return response.data;
}

export function useWhatsappUsers(params: WhatsappUserListParams) {
  return useQuery({
    queryKey: whatsappUsersKeys.list({ ...params }),
    queryFn: () => fetchWhatsappUsers(params),
    placeholderData: keepPreviousData,
  });
}

export function useWhatsappUser(id?: number) {
  return useQuery({
    queryKey: whatsappUsersKeys.detail(id ?? 0),
    queryFn: () => fetchWhatsappUser(id ?? 0),
    enabled: !!id,
  });
}

export function useCompanies() {
  return useQuery({
    queryKey: whatsappUsersKeys.companies,
    queryFn: fetchCompanies,
  });
}

export function useWhatsappUsersApi() {
  const queryClient = useQueryClient();

  const invalidate = (id?: number) => {
    queryClient.invalidateQueries({ queryKey: whatsappUsersKeys.all });
    if (id) {
      queryClient.invalidateQueries({ queryKey: whatsappUsersKeys.detail(id) });
    }
  };

  const createWhatsappUserMutation = useMutation({
    mutationFn: createWhatsappUser,
    onSuccess: () => invalidate(),
  });

  const updateWhatsappUserMutation = useMutation({
    mutationFn: updateWhatsappUser,
    onSuccess: (data) => invalidate(data.id),
  });

  const deleteWhatsappUserMutation = useMutation({
    mutationFn: deleteWhatsappUser,
    onSuccess: () => invalidate(),
  });

  return {
    createWhatsappUser: createWhatsappUserMutation,
    updateWhatsappUser: updateWhatsappUserMutation,
    deleteWhatsappUser: deleteWhatsappUserMutation,
  };
}
