import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useProjectsApi } from '@/hooks/use-projects-api';
import { type ProjectFormData, projectFormSchema } from '../@interface/project.interface';

export function useProjectForm(initialData?: ProjectFormData) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createProject, updateProject } = useProjectsApi();

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    values: initialData,
    defaultValues: {
      code: '',
      name: '',
      context: '',
      active: true,
      ...initialData,
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (data.id) {
        await updateProject.mutateAsync({ ...data, id: data.id });
      } else {
        await createProject.mutateAsync(data);
      }
      toast.success(t('save.success'));
      navigate({ to: '/cadastros/obras' });
    } catch {
      // Erros HTTP já geram toast no client da API.
    }
  });

  return {
    form,
    onSubmit,
    isPending: createProject.isPending || updateProject.isPending,
  };
}
