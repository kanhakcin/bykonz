import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useProjectsApi } from '@/hooks/use-projects-api';
import { type ProjectFormData, projectFormSchema } from '../@interface/project.interface';

export function useProjectForm(initialData?: ProjectFormData, coverFile?: File | null) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createProject, updateProject, uploadCover } = useProjectsApi();

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    values: initialData,
    defaultValues: {
      code: '',
      name: '',
      context: '',
      active: true,
      whatsappGroupId: '',
      whatsappAutoReportEnabled: false,
      ...initialData,
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      // A capa é enviada à parte (precisa do id da obra) — no create, após salvar.
      const saved = data.id ? await updateProject.mutateAsync({ ...data, id: data.id }) : await createProject.mutateAsync(data);
      if (coverFile) {
        await uploadCover.mutateAsync({ id: saved.id, file: coverFile });
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
    isPending: createProject.isPending || updateProject.isPending || uploadCover.isPending,
  };
}
