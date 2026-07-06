import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useMemo } from 'react';
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
import { useStandard, useStandardsApi } from '@/hooks/use-standards-api';
import { StandardForm } from '../@components/standard-form';
import { useStandardForm } from '../@hooks/use-standard-form';
import type { Standard, StandardFormData } from '../@interface/standard.interface';

const searchSchema = z.object({
  id: z.number().optional(),
});

export const Route = createFileRoute('/_private/cadastros/normas/add/')({
  staticData: {
    title: 'cadastros.tile.standards',
    description: 'Criação e edição de uma norma ou procedimento.',
    tags: ['cadastros', 'normas', 'standards'],
    searchParams: [{ name: 'id', type: 'number', description: 'Id da norma para edição; vazio para criação.' }],
    entities: ['Standard'],
    capabilities: ['Criar norma', 'Editar norma', 'Excluir norma'],
    relatedRoutes: [{ path: '/_private/cadastros/normas', relation: 'parent', description: 'Listagem de normas' }],
  },
  component: StandardAddPage,
  validateSearch: searchSchema,
});

function StandardAddPage() {
  const { id } = useSearch({ from: '/_private/cadastros/normas/add/' });
  const { data: standard, isLoading } = useStandard(id);

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

  return <StandardAddFormContent initialData={standard} />;
}

function StandardAddFormContent({ initialData }: { initialData?: Standard }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { deleteStandard } = useStandardsApi();

  const formData = useMemo<StandardFormData | undefined>(() => {
    if (!initialData) return undefined;
    return {
      id: initialData.id,
      code: initialData.code,
      title: initialData.title,
      description: initialData.description ?? '',
      version: initialData.version ?? '',
      active: initialData.active,
    };
  }, [initialData]);

  const { form, onSubmit, isPending } = useStandardForm(formData);

  const handleDelete = async () => {
    if (!initialData?.id) return;
    try {
      await deleteStandard.mutateAsync(initialData.id);
      toast.success(t('delete.success'));
      navigate({ to: '/cadastros/normas' });
    } catch {
      // Erros HTTP já geram toast no client da API.
    }
  };

  return (
    <Card>
      <CardHeader />
      <Form {...form}>
        <form onSubmit={onSubmit}>
          <CardContent>
            <StandardForm />
          </CardContent>
          <CardFooter>
            {initialData && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={deleteStandard.isPending || isPending}>
                    {deleteStandard.isPending ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
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
