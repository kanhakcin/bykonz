import { z } from 'zod';

export const PANEL_USER_ROLES = ['ADMIN', 'MANAGER'] as const;

export type PanelUserRole = (typeof PANEL_USER_ROLES)[number];

export const panelUserFormSchema = z.object({
  id: z.number().optional(),
  email: z.string().min(1, 'required').email('email.invalid'),
  name: z.string().min(1, 'required'),
  role: z.enum(PANEL_USER_ROLES),
  active: z.boolean(),
  password: z.union([z.string().min(8, 'form.min.length'), z.literal('')]).optional(),
});

export type PanelUserFormData = z.infer<typeof panelUserFormSchema>;

export interface PanelUser {
  id: number;
  email: string;
  name: string;
  role: PanelUserRole;
  active: boolean;
}

export interface PanelUserListResponse {
  data: PanelUser[];
  totalCount: number;
}
