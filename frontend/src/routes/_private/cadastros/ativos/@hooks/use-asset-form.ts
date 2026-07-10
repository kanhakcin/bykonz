import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAssetsApi } from '@/hooks/use-assets-api';
import { type AssetFormData, assetFormSchema } from '../@interface/asset.interface';

export function useAssetForm(initialData?: AssetFormData) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createAsset, updateAsset } = useAssetsApi();

  const form = useForm<AssetFormData>({
    resolver: zodResolver(assetFormSchema),
    values: initialData,
    defaultValues: {
      code: '',
      name: '',
      active: true,
      ...initialData,
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (data.id) {
        await updateAsset.mutateAsync({ ...data, id: data.id });
      } else {
        await createAsset.mutateAsync(data);
      }
      toast.success(t('save.success'));
      navigate({ to: '/cadastros/ativos' });
    } catch {
      // Erros HTTP já geram toast no client da API.
    }
  });

  return {
    form,
    onSubmit,
    isPending: createAsset.isPending || updateAsset.isPending,
  };
}
