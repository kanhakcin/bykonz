import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import DefaultFormLayout from '@/components/default-form-layout';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAssetTypes } from '@/hooks/use-assets-api';
import { useProjectsSelect } from '@/hooks/use-projects-api';
import type { AssetFormData } from '../@interface/asset.interface';

export function AssetForm() {
  const { t } = useTranslation();
  const form = useFormContext<AssetFormData>();
  const { data: assetTypes = [] } = useAssetTypes();
  const { data: projects = [] } = useProjectsSelect();

  const sections = [
    {
      title: t('general.information'),
      fields: [
        <div key="row-code" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('code')} *</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={60} placeholder={t('code')} />
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
        <div key="row-type-project" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="assetTypeId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('asset.type')} *</FormLabel>
                <Select value={field.value ? String(field.value) : undefined} onValueChange={(val) => field.onChange(Number(val))}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('select.placeholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {assetTypes.map((type) => (
                      <SelectItem key={type.id} value={String(type.id)}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('asset.project')} *</FormLabel>
                <Select value={field.value ? String(field.value) : undefined} onValueChange={(val) => field.onChange(Number(val))}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('select.placeholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
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
          />
        </div>,
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
