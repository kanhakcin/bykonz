import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client.api';
import type { Person, PersonFormData, PersonListResponse } from '@/routes/_private/cadastros/pessoas/@interface/person.interface';

export const peopleKeys = {
  all: ['people'] as const,
  lists: () => [...peopleKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...peopleKeys.lists(), params] as const,
  details: () => [...peopleKeys.all, 'detail'] as const,
  detail: (id: number) => [...peopleKeys.details(), id] as const,
};

export interface PersonListParams {
  search?: string;
  page?: number;
  size?: number;
}

async function fetchPeople(params: PersonListParams): Promise<PersonListResponse> {
  const response = await api.get<PersonListResponse>('/people', { params });
  return response.data;
}

async function fetchPerson(id: number): Promise<Person> {
  const response = await api.get<Person>(`/people/${id}`);
  return response.data;
}

async function createPerson(data: PersonFormData): Promise<Person> {
  const response = await api.post<Person>('/people', data);
  return response.data;
}

async function updatePerson({ id, ...data }: PersonFormData & { id: number }): Promise<Person> {
  const response = await api.put<Person>(`/people/${id}`, data);
  return response.data;
}

async function deletePerson(id: number): Promise<void> {
  await api.delete(`/people/${id}`);
}

export function usePeople(params: PersonListParams) {
  return useQuery({
    queryKey: peopleKeys.list({ ...params }),
    queryFn: () => fetchPeople(params),
    placeholderData: keepPreviousData,
  });
}

export function usePerson(id?: number) {
  return useQuery({
    queryKey: peopleKeys.detail(id ?? 0),
    queryFn: () => fetchPerson(id ?? 0),
    enabled: !!id,
  });
}

export function usePeopleApi() {
  const queryClient = useQueryClient();

  const createPersonMutation = useMutation({
    mutationFn: createPerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.lists() });
    },
  });

  const updatePersonMutation = useMutation({
    mutationFn: updatePerson,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.lists() });
      queryClient.invalidateQueries({ queryKey: peopleKeys.detail(data.id) });
    },
  });

  const deletePersonMutation = useMutation({
    mutationFn: deletePerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.lists() });
    },
  });

  return {
    createPerson: createPersonMutation,
    updatePerson: updatePersonMutation,
    deletePerson: deletePersonMutation,
  };
}
