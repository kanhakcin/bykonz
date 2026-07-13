import { createFileRoute, redirect, useNavigate, useSearch } from '@tanstack/react-router';
import { MoreVertical, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import DefaultEmptyData from '@/components/default-empty-data';
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
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { usePanelUsers, usePanelUsersApi } from '@/hooks/use-panel-users-api';
import { useWhatsappUsers, useWhatsappUsersApi } from '@/hooks/use-whatsapp-users-api';

const searchSchema = z.object({
  tab: z.enum(['painel', 'whatsapp']).optional(),
  page: z.number().optional(),
  size: z.number().optional(),
  search: z.string().optional(),
});

type SearchParams = z.infer<typeof searchSchema>;

export const Route = createFileRoute('/_private/cadastros/usuarios/')({
  staticData: {
    title: 'cadastros.tile.panelUsers',
    description: 'Listagem dos usuários com acesso ao painel do gestor e dos usuários liberados no bot do WhatsApp, com busca e paginação.',
    tags: ['cadastros', 'usuarios', 'acesso', 'painel', 'whatsapp'],
    entities: ['PanelUser', 'User'],
    capabilities: ['Listar usuários do painel', 'Listar usuários do WhatsApp', 'Buscar por nome, email ou telefone', 'Criar, editar e excluir usuários'],
    relatedRoutes: [
      { path: '/_private/cadastros/usuarios/add', relation: 'child', description: 'Criar ou editar um usuário do painel' },
      { path: '/_private/cadastros/usuarios/add-whatsapp', relation: 'child', description: 'Criar ou editar um usuário do WhatsApp' },
    ],
  },
  beforeLoad: () => {
    if (useAuth.getState().user?.role !== 'ADMIN') {
      throw redirect({ to: '/cadastros' });
    }
  },
  component: UsersListPage,
  validateSearch: (search: Record<string, unknown>): SearchParams => searchSchema.parse(search),
});

function UsersListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate({ from: Route.fullPath });
  const { tab = 'painel', page = 1, size = 20, search } = useSearch({ from: '/_private/cadastros/usuarios/' });

  return (
    <Card>
      <CardHeader title={t(tab === 'painel' ? 'cadastros.tile.panelUsers' : 'cadastros.tile.whatsappUsers')}>
        <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
          <Tabs value={tab} onValueChange={(value) => navigate({ search: { tab: value as SearchParams['tab'], page: 1 } })}>
            <TabsList>
              <TabsTrigger value="painel">{t('cadastros.tile.panelUsers')}</TabsTrigger>
              <TabsTrigger value="whatsapp">{t('cadastros.tile.whatsappUsers')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:max-w-64">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('search')}
              className="pl-8"
              defaultValue={search || ''}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  navigate({
                    search: (prev: SearchParams) => ({
                      ...prev,
                      search: e.currentTarget.value || undefined,
                      page: 1,
                    }),
                  });
                }
              }}
            />
          </div>
          <Button onClick={() => navigate({ to: tab === 'painel' ? '/cadastros/usuarios/add' : '/cadastros/usuarios/add-whatsapp' })}>
            <Plus className="size-4" />
            {t('add')}
          </Button>
        </div>
      </CardHeader>

      {tab === 'painel' ? <PanelUsersTab page={page} size={size} search={search} /> : <WhatsappUsersTab page={page} size={size} search={search} />}
    </Card>
  );
}

interface UsersTabProps {
  page: number;
  size: number;
  search?: string;
}

function PanelUsersTab({ page, size, search }: UsersTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate({ from: Route.fullPath });

  const { data, isLoading } = usePanelUsers({ search, page: page - 1, size });
  const { deletePanelUser } = usePanelUsersApi();

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const items = data?.data || [];
  const totalCount = data?.totalCount || 0;

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deletePanelUser.mutateAsync(deleteId);
      toast.success(t('delete.success'));
    } catch {
      // Erros HTTP já geram toast no client da API.
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <>
      <CardContent>
        {isLoading ? (
          <DefaultLoading />
        ) : items.length === 0 ? (
          <DefaultEmptyData />
        ) : (
          <ItemGroup className="gap-2">
            {items.map((item) => (
              <Item key={item.id} variant="outline" className="cursor-pointer" onClick={() => navigate({ to: '/cadastros/usuarios/add', search: { id: item.id } })}>
                <ItemContent className="gap-0">
                  <ItemTitle className="text-base">{item.name}</ItemTitle>
                  <ItemDescription>{item.email}</ItemDescription>
                </ItemContent>

                <Badge variant="outline">{t(`panelUser.role.${item.role}`)}</Badge>
                <Badge variant={item.active ? 'secondary' : 'outline'}>{item.active ? t('active') : t('inactive')}</Badge>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate({ to: '/cadastros/usuarios/add', search: { id: item.id } })}>{t('edit')}</DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(item.id);
                      }}
                    >
                      {t('delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>

      <UsersListFooter page={page} size={size} totalCount={totalCount} />

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.confirmation')}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete.message.default')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function WhatsappUsersTab({ page, size, search }: UsersTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate({ from: Route.fullPath });

  const { data, isLoading } = useWhatsappUsers({ search, page: page - 1, size });
  const { deleteWhatsappUser } = useWhatsappUsersApi();

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const items = data?.data || [];
  const totalCount = data?.totalCount || 0;

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteWhatsappUser.mutateAsync(deleteId);
      toast.success(t('delete.success'));
    } catch {
      // Erros HTTP já geram toast no client da API (ex: usuário com registros).
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <>
      <CardContent>
        {isLoading ? (
          <DefaultLoading />
        ) : items.length === 0 ? (
          <DefaultEmptyData />
        ) : (
          <ItemGroup className="gap-2">
            {items.map((item) => (
              <Item key={item.id} variant="outline" className="cursor-pointer" onClick={() => navigate({ to: '/cadastros/usuarios/add-whatsapp', search: { id: item.id } })}>
                <ItemContent className="gap-0">
                  <ItemTitle className="text-base">{item.name || item.phoneE164}</ItemTitle>
                  <ItemDescription>
                    {item.phoneE164}
                    {item.role ? ` · ${item.role}` : ''}
                  </ItemDescription>
                </ItemContent>

                {item.companies.map((company) => (
                  <Badge key={company.id} variant="outline">
                    {company.name || `#${company.id}`}
                  </Badge>
                ))}
                <Badge variant={item.active ? 'secondary' : 'outline'}>{item.active ? t('active') : t('inactive')}</Badge>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate({ to: '/cadastros/usuarios/add-whatsapp', search: { id: item.id } })}>{t('edit')}</DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(item.id);
                      }}
                    >
                      {t('delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>

      <UsersListFooter page={page} size={size} totalCount={totalCount} />

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete.confirmation')}</AlertDialogTitle>
            <AlertDialogDescription>{t('delete.message.default')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function UsersListFooter({ page, size, totalCount }: { page: number; size: number; totalCount: number }) {
  const { t } = useTranslation();
  const navigate = useNavigate({ from: Route.fullPath });
  const totalPages = Math.ceil(totalCount / size);

  if (totalCount === 0) return null;

  return (
    <CardFooter layout="multi">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <span>{t('show')}</span>
        <Select value={String(size)} onValueChange={(val) => navigate({ search: (prev: SearchParams) => ({ ...prev, size: Number(val), page: 1 }) })}>
          <SelectTrigger className="h-8 w-16">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
        <span>{t('per.page')}</span>
        <span className="ml-4 tabular-nums">
          {t('total')}: {totalCount}
        </span>
      </div>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => page > 1 && navigate({ search: (prev: SearchParams) => ({ ...prev, page: page - 1 }) })}
              className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              onClick={() => page < totalPages && navigate({ search: (prev: SearchParams) => ({ ...prev, page: page + 1 }) })}
              className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </CardFooter>
  );
}
