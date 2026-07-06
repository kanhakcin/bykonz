# Padroes de Interface, Schema e Consts

## Schema Zod + Interface

Arquivo: `@interface/{feature}.interface.ts`

```tsx
import { z } from 'zod';

// 1. Schema Zod para validacao de formulario
export const featureFormSchema = z.object({
  id: z.string().optional(),
  idEnterprise: z.string().min(1, 'enterprise.required'),
  type: z.object({
    value: z.string().min(1, 'type.required'),
    label: z.string().optional(),
  }),
  code: z.string().min(1, 'code.required'),
  description: z.string().min(1, 'description.required'),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  color: z.string().min(1, 'color.required'),
  active: z.boolean().default(false),
});

// 2. Type inferido do schema
export type FeatureFormData = z.infer<typeof featureFormSchema>;

// 3. Interface para dados da API (response)
export interface Feature {
  id: string;
  idEnterprise: string;
  enterprise?: {
    id: string;
    name: string;
  };
  type: {
    value: string;
    label?: string;
  };
  code: string;
  description: string;
  city?: string;
  state?: string;
  color: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}
```

## Padrao de Consts

Arquivo: `@consts/{feature}.consts.ts`

```tsx
import { Anchor, Box, MapPin, Navigation } from 'lucide-react';

// Enum de tipos
export const TYPE_FEATURE = {
  TYPE_A: 'type_a',
  TYPE_B: 'type_b',
  TYPE_C: 'type_c',
  OTHER: 'other',
} as const;

// Config de tipos com icones e cores
export const FEATURE_TYPES_CONFIG = {
  [TYPE_FEATURE.TYPE_A]: {
    icon: Anchor,
    color: 'text-success-500',
  },
  [TYPE_FEATURE.TYPE_B]: {
    icon: Box,
    color: 'text-info-500',
  },
  [TYPE_FEATURE.TYPE_C]: {
    icon: Navigation,
    color: 'text-destructive',
  },
  [TYPE_FEATURE.OTHER]: {
    icon: MapPin,
    color: 'text-primary-600',
  },
} as const;

// Valores fixos
export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_COLOR = '#3366FF';
```

## Resumo

- Schema Zod no `@interface/` para validacao de form
- Type inferido com `z.infer<typeof schema>`
- Interface separada para dados da API (response)
- Consts em `@consts/` com enums e configs tipadas com `as const`
