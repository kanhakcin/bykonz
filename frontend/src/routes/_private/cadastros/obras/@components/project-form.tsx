import { Loader2, MailCheck } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import DefaultFormLayout from '@/components/default-form-layout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useProjectsApi } from '@/hooks/use-projects-api';
import type { ProjectFormData } from '../@interface/project.interface';

/** Remove vazios/espaços da lista de e-mails digitada no textarea. */
function cleanRecipients(value: string[] | undefined): string[] {
  return (value ?? []).map((email) => email.trim()).filter(Boolean);
}

export function ProjectForm() {
  const { t } = useTranslation();
  const form = useFormContext<ProjectFormData>();
  const { testEmail } = useProjectsApi();

  const handleTestEmail = async () => {
    const recipients = cleanRecipients(form.getValues('reportEmailRecipients'));
    if (recipients.length === 0) {
      toast.warning(t('project.testEmail.empty'));
      return;
    }
    try {
      await testEmail.mutateAsync(recipients);
      toast.success(t('project.testEmail.success'));
    } catch {
      // Erros HTTP (SMTP off, envio falhou, e-mail inválido) já geram toast no client da API.
    }
  };

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
    {
      title: 'WhatsApp',
      fields: [
        <FormField
          key="whatsappGroupId"
          control={form.control}
          name="whatsappGroupId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('project.whatsappGroupId')}</FormLabel>
              <FormControl>
                <Input {...field} maxLength={100} placeholder="1203630xxxxx@g.us" />
              </FormControl>
              <p className="text-muted-foreground text-sm">{t('project.whatsappGroupId.help')}</p>
              <FormMessage />
            </FormItem>
          )}
        />,
        <FormField
          key="whatsappAutoReportEnabled"
          control={form.control}
          name="whatsappAutoReportEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>{t('project.whatsappAutoReportEnabled')}</FormLabel>
              </div>
            </FormItem>
          )}
        />,
      ],
    },
    {
      title: t('email'),
      fields: [
        <FormField
          key="reportEmailRecipients"
          control={form.control}
          name="reportEmailRecipients"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('project.reportEmailRecipients')}</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder={'engenheiro@empresa.com.br\ncliente@empresa.com.br'}
                  value={(field.value ?? []).join('\n')}
                  onChange={(event) => field.onChange(event.target.value.split('\n'))}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              </FormControl>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-muted-foreground text-sm">{t('project.reportEmailRecipients.help')}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestEmail}
                  disabled={testEmail.isPending || cleanRecipients(field.value).length === 0}
                >
                  {testEmail.isPending ? <Loader2 className="animate-spin" /> : <MailCheck />}
                  {t('project.testEmail')}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />,
        <FormField
          key="emailAutoReportEnabled"
          control={form.control}
          name="emailAutoReportEnabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>{t('project.emailAutoReportEnabled')}</FormLabel>
              </div>
            </FormItem>
          )}
        />,
      ],
    },
  ];

  return <DefaultFormLayout sections={sections} />;
}
