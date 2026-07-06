# Padrao de Hook de Formulario e Componente de Form

## Hook de Formulario

Arquivo: `@hooks/use-{feature}-form.ts`

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useFeaturesApi } from '@/hooks/use-features-api';
import { type FeatureFormData, featureFormSchema } from '../@interface/feature.interface';

export function useFeatureForm(initialData?: Partial<FeatureFormData>) {
  const { createFeature, updateFeature } = useFeaturesApi();

  const form = useForm<FeatureFormData>({
    resolver: zodResolver(featureFormSchema),
    values: initialData as FeatureFormData,
    defaultValues: {
      // valores padrao para criacao
      color: '#3366FF',
      active: true,
      ...initialData,
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    if (data.id) {
      await updateFeature.mutateAsync({ ...data, id: data.id });
    } else {
      await createFeature.mutateAsync(data);
    }
  });

  return {
    form,
    onSubmit,
    isPending: createFeature.isPending || updateFeature.isPending,
  };
}
```

## Componente de Formulario

Arquivo: `@components/{feature}-form.tsx`

O componente de formulario usa `useFormContext` (nao recebe form por props) e organiza campos em secoes via `DefaultFormLayout`.

```tsx
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import DefaultFormLayout from '@/components/default-form-layout';
import { EnterpriseSelect } from '@/components/selects';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

import type { FeatureFormData } from '../@interface/feature.interface';

export function FeatureForm() {
  const { t } = useTranslation();
  const form = useFormContext<FeatureFormData>();

  const sections = [
    {
      title: t('general.information'),
      description: t('feature.general.description'),
      fields: [
        <FormField
          key="idEnterprise"
          control={form.control}
          name="idEnterprise"
          render={({ field }) => (
            <FormItem>
              <EnterpriseSelect mode="single" value={field.value} onChange={field.onChange} />
              <FormMessage />
            </FormItem>
          )}
        />,
        <FormField
          key="description"
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('description')} *</FormLabel>
              <FormControl>
                <Input {...field} placeholder={t('description')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />,
        <div key="row-fields" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('code')} *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t('code')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>,
      ],
    },
    {
      title: t('advanced.settings'),
      description: t('feature.advanced.description'),
      fields: [
        <div key="row-checks" className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>{t('active')}</FormLabel>
                </div>
              </FormItem>
            )}
          />
        </div>,
      ],
    },
  ];

  return <DefaultFormLayout sections={sections} />;
}
```

## Resumo

- Hook usa `zodResolver` + `useForm` com `values` para edicao e `defaultValues` para criacao
- Componente usa `useFormContext` (nao recebe form por props)
- Layout usa `DefaultFormLayout` com array de `sections` contendo `title`, `description`, `fields`
- Selects prontos de `@/components/selects`
- Todas as labels e placeholders devem usar `t('chave')` i18n
