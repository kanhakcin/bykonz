import { z } from 'zod';

export const assetFormSchema = z.object({
  id: z.number().optional(),
  code: z.string().min(1, 'required'),
  name: z.string().min(1, 'required'),
  assetTypeId: z.number({ error: 'required' }).int().positive('required'),
  projectId: z.number({ error: 'required' }).int().positive('required'),
  active: z.boolean(),
});

export type AssetFormData = z.infer<typeof assetFormSchema>;

export interface Asset {
  id: number;
  code: string;
  name: string;
  assetTypeId: number;
  assetTypeName: string;
  projectId: number;
  active: boolean;
}

export interface AssetType {
  id: number;
  code: string;
  name: string;
  level: number;
  parentTypeId: number | null;
}

export interface AssetListResponse {
  data: Asset[];
  totalCount: number;
}
