import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import DefaultFormLayout from '@/components/default-form-layout';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjectsSelect } from '@/hooks/use-projects-api';
import { PERSON_STATUSES, type PersonFormData } from '../@interface/person.interface';

const NO_PROJECT = 'none';

export function PersonForm() {
  const { t } = useTranslation();
  const form = useFormContext<PersonFormData>();
  const { data: projects = [] } = useProjectsSelect();

  const sections = [
    {
      title: t('general.information'),
      fields: [
        <div key="row-name" className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
          <FormField
            control={form.control}
            name="registrationCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('person.registrationCode')}</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={60} placeholder={t('person.registrationCode')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>,
        <div key="row-role-status" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('person.role')}</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={100} placeholder={t('person.role')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('status')} *</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PERSON_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(`person.status.${status}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>,
        <FormField
          key="projectId"
          control={form.control}
          name="projectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('person.project')}</FormLabel>
              <Select value={field.value ? String(field.value) : NO_PROJECT} onValueChange={(val) => field.onChange(val === NO_PROJECT ? null : Number(val))}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('select.placeholder')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_PROJECT}>{t('none')}</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />,
      ],
    },
  ];

  return <DefaultFormLayout sections={sections} />;
}
