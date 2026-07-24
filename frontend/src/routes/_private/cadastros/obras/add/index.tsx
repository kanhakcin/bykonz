import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import DefaultLoading from '@/components/default-loading';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Spinner } from '@/components/ui/spinner';
import { useProject, useProjectsApi } from '@/hooks/use-projects-api';
import { ProjectCoverField } from '../@components/project-cover-field';
import { ProjectForm } from '../@components/project-form';
import { useProjectForm } from '../@hooks/use-project-form';
import type { Project, ProjectFormData } from '../@interface/project.interface';

const searchSchema = z.object({
  id: z.number().optional(),
});

export const Route = createFileRoute('/_private/cadastros/obras/add/')({
  staticData: {
    title: 'cadastros.tile.projects',
    description: 'Criação e edição de uma obra (projeto).',
    tags: ['cadastros', 'obras', 'projetos'],
    searchParams: [{ name: 'id', type: 'number', description: 'Id da obra para edição; vazio para criação.' }],
    entities: ['Project'],
    capabilities: ['Criar obra', 'Editar obra', 'Excluir obra'],
    relatedRoutes: [{ path: '/_private/cadastros/obras', relation: 'parent', description: 'Listagem de obras' }],
  },
  component: ProjectAddPage,
  validateSearch: searchSchema,
});

function ProjectAddPage() {
  const { id } = useSearch({ from: '/_private/cadastros/obras/add/' });
  const { data: project, isLoading } = useProject(id);

  if (id && isLoading) {
    return (
      <Card>
        <CardHeader />
        <CardContent className="p-12">
          <DefaultLoading />
        </CardContent>
      </Card>
    );
  }

  return <ProjectAddFormContent initialData={project} />;
}

function ProjectAddFormContent({ initialData }: { initialData?: Project }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { deleteProject } = useProjectsApi();
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const formData = useMemo<ProjectFormData | undefined>(() => {
    if (!initialData) return undefined;
    return {
      id: initialData.id,
      code: initialData.code,
      name: initialData.name,
      context: initialData.context ?? '',
      active: initialData.active,
      whatsappGroupId: initialData.whatsappGroupId ?? '',
      whatsappAutoReportEnabled: initialData.whatsappAutoReportEnabled,
      reportEmailRecipients: initialData.reportEmailRecipients,
      emailAutoReportEnabled: initialData.emailAutoReportEnabled,
    };
  }, [initialData]);

  const { form, onSubmit, isPending } = useProjectForm(formData, coverFile);

  const handleDelete = async () => {
    if (!initialData?.id) return;
    try {
      await deleteProject.mutateAsync(initialData.id);
      toast.success(t('delete.success'));
      navigate({ to: '/cadastros/obras' });
    } catch {
      // Erros HTTP já geram toast no client da API.
    }
  };

  return (
    <Card>
      <CardHeader />
      <Form {...form}>
        <form onSubmit={onSubmit}>
          <CardContent className="flex flex-col gap-6">
            <ProjectForm />
            <ProjectCoverField currentCover={initialData?.coverImage} onFileChange={setCoverFile} />
          </CardContent>
          <CardFooter>
            {initialData && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={deleteProject.isPending || isPending}>
                    {deleteProject.isPending ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
                    {t('delete')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('delete.confirmation')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('delete.message.default')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleDelete}>
                      <Trash2 className="size-4" />
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button type="submit" disabled={isPending} className="ml-auto min-w-30">
              {isPending && <Spinner className="size-4" />}
              {t('save')}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
