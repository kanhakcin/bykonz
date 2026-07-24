import { z } from 'zod';

export const projectFormSchema = z.object({
  id: z.number().optional(),
  code: z.string().min(1, 'required'),
  name: z.string().min(1, 'required'),
  context: z.string().optional(),
  active: z.boolean(),
  whatsappGroupId: z.string().optional(),
  whatsappAutoReportEnabled: z.boolean(),
  reportEmailRecipients: z.array(z.string()),
  emailAutoReportEnabled: z.boolean(),
});

export type ProjectFormData = z.infer<typeof projectFormSchema>;

export interface Project {
  id: number;
  code: string;
  name: string;
  context: string | null;
  active: boolean;
  /** URL relativa da capa (`/projects/:id/cover`) quando há imagem; senão null. */
  coverImage: string | null;
  whatsappGroupId: string | null;
  whatsappAutoReportEnabled: boolean;
  reportEmailRecipients: string[];
  emailAutoReportEnabled: boolean;
}

export interface ProjectListResponse {
  data: Project[];
  totalCount: number;
}
