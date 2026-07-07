import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { usePanelUsersApi } from '@/hooks/use-panel-users-api';
import { type PanelUserFormData, panelUserFormSchema } from '../@interface/panel-user.interface';

export function usePanelUserForm(initialData?: PanelUserFormData) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createPanelUser, updatePanelUser } = usePanelUsersApi();

  const form = useForm<PanelUserFormData>({
    resolver: zodResolver(panelUserFormSchema),
    values: initialData,
    defaultValues: {
      email: '',
      name: '',
      role: 'MANAGER',
      active: true,
      password: '',
      ...initialData,
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const payload = { ...data, password: data.password || undefined };
      if (data.id) {
        await updatePanelUser.mutateAsync({ ...payload, id: data.id });
      } else {
        await createPanelUser.mutateAsync(payload);
      }
      toast.success(t('save.success'));
      navigate({ to: '/cadastros/usuarios' });
    } catch {
      // Erros HTTP já geram toast no client da API.
    }
  });

  return {
    form,
    onSubmit,
    isPending: createPanelUser.isPending || updatePanelUser.isPending,
  };
}
