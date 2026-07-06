import { z } from 'zod';

export const standardFormSchema = z.object({
  id: z.number().optional(),
  code: z.string().min(1, 'required'),
  title: z.string().min(1, 'required'),
  description: z.string().optional(),
  version: z.string().optional(),
  active: z.boolean(),
});

export type StandardFormData = z.infer<typeof standardFormSchema>;

export interface Standard {
  id: number;
  code: string;
  title: string;
  description: string | null;
  version: string | null;
  active: boolean;
}

export interface StandardListResponse {
  data: Standard[];
  totalCount: number;
}
