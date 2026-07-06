import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import DefaultFormLayout from '@/components/default-form-layout';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { ProjectFormData } from '../@interface/project.interface';

export function ProjectForm() {
  const { t } = useTranslation();
  const form = useFormContext<ProjectFormData>();

  const sections = [
    {
      title: t('general.information'),
      fields: [
        <div key="row-code" className="grid grid-cols-1 gap-4 md:grid-cols-[12rem_1fr]">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('code')} *</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={30} placeholder={t('code')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('name')} *</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={200} placeholder={t('name')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>,
        <FormField
          key="context"
          control={form.control}
          name="context"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('context')}</FormLabel>
              <FormControl>
                <Input {...field} maxLength={200} placeholder={t('context')} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />,
        <FormField
          key="active"
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
        />,
      ],
    },
  ];

  return <DefaultFormLayout sections={sections} />;
}
