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
import { usePeopleApi, usePerson } from '@/hooks/use-people-api';
import { PersonForm } from '../@components/person-form';
import { usePersonForm } from '../@hooks/use-person-form';
import type { Person, PersonFormData } from '../@interface/person.interface';

const searchSchema = z.object({
  id: z.number().optional(),
});

export const Route = createFileRoute('/_private/cadastros/pessoas/add/')({
  staticData: {
    title: 'cadastros.tile.people',
    description: 'Criação e edição de uma pessoa (força de trabalho).',
    tags: ['cadastros', 'pessoas', 'people'],
    searchParams: [{ name: 'id', type: 'number', description: 'Id da pessoa para edição; vazio para criação.' }],
    entities: ['Person'],
    capabilities: ['Criar pessoa', 'Editar pessoa', 'Excluir pessoa'],
    relatedRoutes: [{ path: '/_private/cadastros/pessoas', relation: 'parent', description: 'Listagem de pessoas' }],
  },
  component: PersonAddPage,
  validateSearch: searchSchema,
});

function PersonAddPage() {
  const { id } = useSearch({ from: '/_private/cadastros/pessoas/add/' });
  const { data: person, isLoading } = usePerson(id);

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

  return <PersonAddFormContent initialData={person} />;
}

function PersonAddFormContent({ initialData }: { initialData?: Person }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { deletePerson } = usePeopleApi();

  const formData = useMemo<PersonFormData | undefined>(() => {
    if (!initialData) return undefined;
    return {
      id: initialData.id,
      name: initialData.name,
      registrationCode: initialData.registrationCode ?? '',
      role: initialData.role ?? '',
      status: initialData.status,
      projectId: initialData.projectId,
    };
  }, [initialData]);

  const { form, onSubmit, isPending } = usePersonForm(formData);

  const handleDelete = async () => {
    if (!initialData?.id) return;
    try {
      await deletePerson.mutateAsync(initialData.id);
      toast.success(t('delete.success'));
      navigate({ to: '/cadastros/pessoas' });
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
            <PersonForm />
          </CardContent>
          <CardFooter>
            {initialData && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={deletePerson.isPending || isPending}>
                    {deletePerson.isPending ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
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
