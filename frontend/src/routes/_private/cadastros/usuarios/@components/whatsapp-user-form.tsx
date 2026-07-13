import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import DefaultFormLayout from '@/components/default-form-layout';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useCompanies } from '@/hooks/use-whatsapp-users-api';
import type { WhatsappUserFormData } from '../@interface/whatsapp-user.interface';

export function WhatsappUserForm() {
  const { t } = useTranslation();
  const form = useFormContext<WhatsappUserFormData>();
  const { data: companies } = useCompanies();

  const sections = [
    {
      title: t('general.information'),
      fields: [
        <div key="row-name-phone" className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('phone')} *</FormLabel>
                <FormControl>
                  <Input {...field} maxLength={30} placeholder="(47) 99999-9999" />
                </FormControl>
                <FormDescription>{t('whatsappUser.phone.help')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>,
        <div key="row-role" className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        </div>,
        <FormField
          key="companies"
          control={form.control}
          name="companyIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('companies')}</FormLabel>
              <FormDescription>{t('whatsappUser.companies.help')}</FormDescription>
              <div className="grid grid-cols-1 gap-2 rounded-md border p-4 md:grid-cols-2">
                {(companies || []).map((company) => {
                  const checked = field.value.includes(company.id);
                  return (
                    <label key={company.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          field.onChange(value ? [...field.value, company.id] : field.value.filter((id) => id !== company.id));
                        }}
                      />
                      {company.name || `#${company.id}`}
                    </label>
                  );
                })}
              </div>
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
