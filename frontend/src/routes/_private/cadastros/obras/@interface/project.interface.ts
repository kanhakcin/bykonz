import { z } from 'zod';

export const projectFormSchema = z.object({
  id: z.number().optional(),
  code: z.string().min(1, 'required'),
  name: z.string().min(1, 'required'),
  context: z.string().optional(),
  active: z.boolean(),
});

export type ProjectFormData = z.infer<typeof projectFormSchema>;

export interface Project {
  id: number;
  code: string;
  name: string;
  context: string | null;
  active: boolean;
}

export interface ProjectListResponse {
  data: Project[];
  totalCount: number;
}
