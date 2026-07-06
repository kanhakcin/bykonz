import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { diaryKeys } from '@/hooks/use-diary-api';
import { api } from '@/lib/api/client.api';
import type { Project, ProjectFormData, ProjectListResponse } from '@/routes/_private/cadastros/obras/@interface/project.interface';

export const projectsKeys = {
  all: ['projects'] as const,
  lists: () => [...projectsKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...projectsKeys.lists(), params] as const,
  select: () => [...projectsKeys.all, 'select'] as const,
  details: () => [...projectsKeys.all, 'detail'] as const,
  detail: (id: number) => [...projectsKeys.details(), id] as const,
};

export interface ProjectListParams {
  search?: string;
  page?: number;
  size?: number;
}

async function fetchProjects(params: ProjectListParams): Promise<ProjectListResponse> {
  const response = await api.get<ProjectListResponse>('/projects', { params });
  return response.data;
}

async function fetchProject(id: number): Promise<Project> {
  const response = await api.get<Project>(`/projects/${id}`);
  return response.data;
}

async function createProject(data: ProjectFormData): Promise<Project> {
  const response = await api.post<Project>('/projects', data);
  return response.data;
}

async function updateProject({ id, ...data }: ProjectFormData & { id: number }): Promise<Project> {
  const response = await api.put<Project>(`/projects/${id}`, data);
  return response.data;
}

async function deleteProject(id: number): Promise<void> {
  await api.delete(`/projects/${id}`);
}

export function useProjects(params: ProjectListParams) {
  return useQuery({
    queryKey: projectsKeys.list({ ...params }),
    queryFn: () => fetchProjects(params),
    placeholderData: keepPreviousData,
  });
}

export function useProject(id?: number) {
  return useQuery({
    queryKey: projectsKeys.detail(id ?? 0),
    queryFn: () => fetchProject(id ?? 0),
    enabled: !!id,
  });
}

/** Obras ativas para o seletor do painel (DataSelect). */
export function useProjectsSelect() {
  return useQuery({
    queryKey: projectsKeys.select(),
    queryFn: async () => {
      const response = await api.get<ProjectListResponse>('/projects', { params: { active: true, size: 100 } });
      return response.data.data;
    },
  });
}

export function useProjectsApi() {
  const queryClient = useQueryClient();

  // Nome/contexto da obra aparecem no diário — invalida o painel junto.
  const invalidate = (id?: number) => {
    queryClient.invalidateQueries({ queryKey: projectsKeys.all });
    queryClient.invalidateQueries({ queryKey: diaryKeys.all });
    if (id) {
      queryClient.invalidateQueries({ queryKey: projectsKeys.detail(id) });
    }
  };

  const createProjectMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => invalidate(),
  });

  const updateProjectMutation = useMutation({
    mutationFn: updateProject,
    onSuccess: (data) => invalidate(data.id),
  });

  const deleteProjectMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => invalidate(),
  });

  return {
    createProject: createProjectMutation,
    updateProject: updateProjectMutation,
    deleteProject: deleteProjectMutation,
  };
}
