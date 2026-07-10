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
import { useAsset, useAssetsApi } from '@/hooks/use-assets-api';
import { AssetForm } from '../@components/asset-form';
import { useAssetForm } from '../@hooks/use-asset-form';
import type { Asset, AssetFormData } from '../@interface/asset.interface';

const searchSchema = z.object({
  id: z.number().optional(),
});

export const Route = createFileRoute('/_private/cadastros/ativos/add/')({
  staticData: {
    title: 'cadastros.tile.assets',
    description: 'Criação e edição de um ativo (objeto vistoriável).',
    tags: ['cadastros', 'ativos', 'assets'],
    searchParams: [{ name: 'id', type: 'number', description: 'Id do ativo para edição; vazio para criação.' }],
    entities: ['Asset'],
    capabilities: ['Criar ativo', 'Editar ativo', 'Excluir ativo'],
    relatedRoutes: [{ path: '/_private/cadastros/ativos', relation: 'parent', description: 'Listagem de ativos' }],
  },
  component: AssetAddPage,
  validateSearch: searchSchema,
});

function AssetAddPage() {
  const { id } = useSearch({ from: '/_private/cadastros/ativos/add/' });
  const { data: asset, isLoading } = useAsset(id);

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

  return <AssetAddFormContent initialData={asset} />;
}

function AssetAddFormContent({ initialData }: { initialData?: Asset }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { deleteAsset } = useAssetsApi();

  const formData = useMemo<AssetFormData | undefined>(() => {
    if (!initialData) return undefined;
    return {
      id: initialData.id,
      code: initialData.code,
      name: initialData.name,
      assetTypeId: initialData.assetTypeId,
      projectId: initialData.projectId,
      active: initialData.active,
    };
  }, [initialData]);

  const { form, onSubmit, isPending } = useAssetForm(formData);

  const handleDelete = async () => {
    if (!initialData?.id) return;
    try {
      await deleteAsset.mutateAsync(initialData.id);
      toast.success(t('delete.success'));
      navigate({ to: '/cadastros/ativos' });
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
            <AssetForm />
          </CardContent>
          <CardFooter>
            {initialData && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="destructive" disabled={deleteAsset.isPending || isPending}>
                    {deleteAsset.isPending ? <Spinner className="size-4" /> : <Trash2 className="size-4" />}
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
