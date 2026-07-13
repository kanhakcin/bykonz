import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useWhatsappUsersApi } from '@/hooks/use-whatsapp-users-api';
import { type WhatsappUserFormData, whatsappUserFormSchema } from '../@interface/whatsapp-user.interface';

export function useWhatsappUserForm(initialData?: WhatsappUserFormData) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createWhatsappUser, updateWhatsappUser } = useWhatsappUsersApi();

  const form = useForm<WhatsappUserFormData>({
    resolver: zodResolver(whatsappUserFormSchema),
    values: initialData,
    defaultValues: {
      name: '',
      phone: '',
      role: '',
      active: true,
      companyIds: [],
      ...initialData,
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const payload = { ...data, role: data.role || undefined };
      if (data.id) {
        await updateWhatsappUser.mutateAsync({ ...payload, id: data.id });
      } else {
        await createWhatsappUser.mutateAsync(payload);
      }
      toast.success(t('save.success'));
      navigate({ to: '/cadastros/usuarios', search: { tab: 'whatsapp' } });
    } catch {
      // Erros HTTP já geram toast no client da API.
    }
  });

  return {
    form,
    onSubmit,
    isPending: createWhatsappUser.isPending || updateWhatsappUser.isPending,
  };
}
