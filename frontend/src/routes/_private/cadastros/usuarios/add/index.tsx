import { createFileRoute, redirect, useNavigate, useSearch } from '@tanstack/react-router';
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
import { useAuth } from '@/hooks/use-auth';
import { usePanelUser, usePanelUsersApi } from '@/hooks/use-panel-users-api';
import { PanelUserForm } from '../@components/panel-user-form';
import { usePanelUserForm } from '../@hooks/use-panel-user-form';
import type { PanelUser, PanelUserFormData } from '../@interface/panel-user.interface';

const searchSchema = z.object({
  id: z.number().optional(),
});

export const Route = createFileRoute('/_private/cadastros/usuarios/add/')({
  staticData: {
    title: 'cadastros.tile.panelUsers',
    description: 'Criação e edição de um usuário com acesso ao painel do gestor.',
    tags: ['cadastros', 'usuarios', 'acesso', 'painel'],
    searchParams: [{ name: 'id', type: 'number', description: 'Id do usuário para edição; vazio para criação.' }],
    entities: ['PanelUser'],
    capabilities: ['Criar usuário do painel', 'Editar usuário do painel', 'Excluir usuário do painel'],
    relatedRoutes: [{ path: '/_private/cadastros/usuarios', relation: 'parent', description: 'Listagem de usuários do painel' }],
  },
  beforeLoad: () => {
    if (useAuth.getState().user?.role !== 'ADMIN') {
      throw redirect({ to: '/cadastros' });
    }
  },
  component: PanelUserAddPage,
  validateSearch: searchSchema,
});

function PanelUserAddPage() {
  const { id } = useSearch({ from: '/_private/cadastros/usuarios/add/' });
  const { data: user, isLoading } = usePanelUser(id);

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

  return <PanelUserAddFormContent initialData={user} />;
}

function PanelUserAddFormContent({ initialData }: { initialData?: PanelUser }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { deletePanelUser } = usePanelUsersApi();

  const formData = useMemo<PanelUserFormData | undefined>(() => {
    if (!initialData) return undefined;
    return {
      id: initialData.id,
      email: initialData.email,
      name: initialData.name,
      role: initialData.role,
      active: initialData.active,
      password: '',
    };
  }, [initialData]);

  const { form, onSubmit, isPending } = usePanelUserForm(formData);

  const handleDelete = async () => {
    if (!initialData?.id) return;
    try {
      await deletePanelUser.mutateAsync(initialData.id);
      toast.success(t('delete.success'));
      navigate({ to: '/cadastros/usuarios' });
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
            <PanelUserForm isEditing={!!initialData} />
          </CardContent>
          <CardFooter>
            {initialData && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={deletePanelUser.isPending || isPending}>
                    {deletePanelUser.isPending ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
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
