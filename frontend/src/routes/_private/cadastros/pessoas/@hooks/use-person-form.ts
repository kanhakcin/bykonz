import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { usePeopleApi } from '@/hooks/use-people-api';
import { type PersonFormData, personFormSchema } from '../@interface/person.interface';

export function usePersonForm(initialData?: PersonFormData) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createPerson, updatePerson } = usePeopleApi();

  const form = useForm<PersonFormData>({
    resolver: zodResolver(personFormSchema),
    values: initialData,
    defaultValues: {
      name: '',
      registrationCode: '',
      role: '',
      status: 'ACTIVE',
      projectId: null,
      ...initialData,
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (data.id) {
        await updatePerson.mutateAsync({ ...data, id: data.id });
      } else {
        await createPerson.mutateAsync(data);
      }
      toast.success(t('save.success'));
      navigate({ to: '/cadastros/pessoas' });
    } catch {
      // Erros HTTP já geram toast no client da API.
    }
  });

  return {
    form,
    onSubmit,
    isPending: createPerson.isPending || updatePerson.isPending,
  };
}
