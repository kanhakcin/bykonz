import { z } from 'zod';

export const PERSON_STATUSES = ['ACTIVE', 'ON_LEAVE', 'TERMINATED'] as const;

export const personFormSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, 'required'),
  registrationCode: z.string().optional(),
  role: z.string().optional(),
  status: z.enum(PERSON_STATUSES),
  projectId: z.number().int().positive().nullable().optional(),
});

export type PersonFormData = z.infer<typeof personFormSchema>;
export type PersonStatus = (typeof PERSON_STATUSES)[number];

export interface Person {
  id: number;
  name: string;
  registrationCode: string | null;
  role: string | null;
  status: PersonStatus;
  projectId: number | null;
}

export interface PersonListResponse {
  data: Person[];
  totalCount: number;
}
