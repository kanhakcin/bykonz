import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client.api';
import type { Asset, AssetFormData, AssetListResponse, AssetType } from '@/routes/_private/cadastros/ativos/@interface/asset.interface';

export const assetsKeys = {
  all: ['assets'] as const,
  lists: () => [...assetsKeys.all, 'list'] as const,
  list: (params?: Record<string, unknown>) => [...assetsKeys.lists(), params] as const,
  types: () => [...assetsKeys.all, 'types'] as const,
  details: () => [...assetsKeys.all, 'detail'] as const,
  detail: (id: number) => [...assetsKeys.details(), id] as const,
};

export interface AssetListParams {
  search?: string;
  page?: number;
  size?: number;
}

async function fetchAssets(params: AssetListParams): Promise<AssetListResponse> {
  const response = await api.get<AssetListResponse>('/assets', { params });
  return response.data;
}

async function fetchAsset(id: number): Promise<Asset> {
  const response = await api.get<Asset>(`/assets/${id}`);
  return response.data;
}

async function fetchAssetTypes(): Promise<AssetType[]> {
  const response = await api.get<AssetType[]>('/asset-types');
  return response.data;
}

async function createAsset(data: AssetFormData): Promise<Asset> {
  const response = await api.post<Asset>('/assets', data);
  return response.data;
}

async function updateAsset({ id, ...data }: AssetFormData & { id: number }): Promise<Asset> {
  const response = await api.put<Asset>(`/assets/${id}`, data);
  return response.data;
}

async function deleteAsset(id: number): Promise<void> {
  await api.delete(`/assets/${id}`);
}

export function useAssets(params: AssetListParams) {
  return useQuery({
    queryKey: assetsKeys.list({ ...params }),
    queryFn: () => fetchAssets(params),
    placeholderData: keepPreviousData,
  });
}

export function useAsset(id?: number) {
  return useQuery({
    queryKey: assetsKeys.detail(id ?? 0),
    queryFn: () => fetchAsset(id ?? 0),
    enabled: !!id,
  });
}

export function useAssetTypes() {
  return useQuery({
    queryKey: assetsKeys.types(),
    queryFn: fetchAssetTypes,
  });
}

export function useAssetsApi() {
  const queryClient = useQueryClient();

  const createAssetMutation = useMutation({
    mutationFn: createAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetsKeys.lists() });
    },
  });

  const updateAssetMutation = useMutation({
    mutationFn: updateAsset,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: assetsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: assetsKeys.detail(data.id) });
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: assetsKeys.lists() });
    },
  });

  return {
    createAsset: createAssetMutation,
    updateAsset: updateAssetMutation,
    deleteAsset: deleteAssetMutation,
  };
}
