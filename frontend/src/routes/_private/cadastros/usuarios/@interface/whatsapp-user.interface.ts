import { z } from 'zod';

export const whatsappUserFormSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, 'required'),
  phone: z
    .string()
    .min(1, 'required')
    .refine((value) => {
      const digits = value.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 15;
    }, 'whatsappUser.invalidPhone'),
  role: z.string().optional(),
  active: z.boolean(),
  companyIds: z.array(z.string()),
});

export type WhatsappUserFormData = z.infer<typeof whatsappUserFormSchema>;

export interface CompanyRef {
  id: string;
  name: string | null;
}

export interface WhatsappUser {
  id: number;
  name: string | null;
  phoneE164: string;
  role: string | null;
  active: boolean;
  companies: CompanyRef[];
}

export interface WhatsappUserListResponse {
  data: WhatsappUser[];
  totalCount: number;
}
