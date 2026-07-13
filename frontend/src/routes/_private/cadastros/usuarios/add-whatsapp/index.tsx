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
import { useWhatsappUser, useWhatsappUsersApi } from '@/hooks/use-whatsapp-users-api';
import { WhatsappUserForm } from '../@components/whatsapp-user-form';
import { useWhatsappUserForm } from '../@hooks/use-whatsapp-user-form';
import type { WhatsappUser, WhatsappUserFormData } from '../@interface/whatsapp-user.interface';

const searchSchema = z.object({
  id: z.number().optional(),
});

export const Route = createFileRoute('/_private/cadastros/usuarios/add-whatsapp/')({
  staticData: {
    title: 'cadastros.tile.whatsappUsers',
    description: 'Criação e edição de um usuário liberado para registrar pelo bot do WhatsApp.',
    tags: ['cadastros', 'usuarios', 'whatsapp', 'bot'],
    searchParams: [{ name: 'id', type: 'number', description: 'Id do usuário WhatsApp para edição; vazio para criação.' }],
    entities: ['User'],
    capabilities: ['Criar usuário WhatsApp', 'Editar usuário WhatsApp', 'Vincular empresas', 'Excluir usuário WhatsApp'],
    relatedRoutes: [{ path: '/_private/cadastros/usuarios', relation: 'parent', description: 'Listagem de usuários (painel e WhatsApp)' }],
  },
  beforeLoad: () => {
    if (useAuth.getState().user?.role !== 'ADMIN') {
      throw redirect({ to: '/cadastros' });
    }
  },
  component: WhatsappUserAddPage,
  validateSearch: searchSchema,
});

function WhatsappUserAddPage() {
  const { id } = useSearch({ from: '/_private/cadastros/usuarios/add-whatsapp/' });
  const { data: user, isLoading } = useWhatsappUser(id);

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

  return <WhatsappUserAddFormContent initialData={user} />;
}

function WhatsappUserAddFormContent({ initialData }: { initialData?: WhatsappUser }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { deleteWhatsappUser } = useWhatsappUsersApi();

  const formData = useMemo<WhatsappUserFormData | undefined>(() => {
    if (!initialData) return undefined;
    return {
      id: initialData.id,
      name: initialData.name ?? '',
      phone: initialData.phoneE164,
      role: initialData.role ?? '',
      active: initialData.active,
      companyIds: initialData.companies.map((company) => company.id),
    };
  }, [initialData]);

  const { form, onSubmit, isPending } = useWhatsappUserForm(formData);

  const handleDelete = async () => {
    if (!initialData?.id) return;
    try {
      await deleteWhatsappUser.mutateAsync(initialData.id);
      toast.success(t('delete.success'));
      navigate({ to: '/cadastros/usuarios', search: { tab: 'whatsapp' } });
    } catch {
      // Erros HTTP já geram toast no client da API (ex: usuário com registros).
    }
  };

  return (
    <Card>
      <CardHeader />
      <Form {...form}>
        <form onSubmit={onSubmit}>
          <CardContent>
            <WhatsappUserForm />
          </CardContent>
          <CardFooter>
            {initialData && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={deleteWhatsappUser.isPending || isPending}>
                    {deleteWhatsappUser.isPending ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
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
