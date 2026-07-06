import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useStandardsApi } from '@/hooks/use-standards-api';
import { type StandardFormData, standardFormSchema } from '../@interface/standard.interface';

export function useStandardForm(initialData?: StandardFormData) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createStandard, updateStandard } = useStandardsApi();

  const form = useForm<StandardFormData>({
    resolver: zodResolver(standardFormSchema),
    values: initialData,
    defaultValues: {
      code: '',
      title: '',
      description: '',
      version: '',
      active: true,
      ...initialData,
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (data.id) {
        await updateStandard.mutateAsync({ ...data, id: data.id });
      } else {
        await createStandard.mutateAsync(data);
      }
      toast.success(t('save.success'));
      navigate({ to: '/cadastros/normas' });
    } catch {
      // Erros HTTP já geram toast no client da API.
    }
  });

  return {
    form,
    onSubmit,
    isPending: createStandard.isPending || updateStandard.isPending,
  };
}
