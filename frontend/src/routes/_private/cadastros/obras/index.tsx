import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
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
import { useProjects, useProjectsApi } from '@/hooks/use-projects-api';

const searchSchema = z.object({
  page: z.number().optional(),
  size: z.number().optional(),
  search: z.string().optional(),
});

type SearchParams = z.infer<typeof searchSchema>;

export const Route = createFileRoute('/_private/cadastros/obras/')({
  staticData: {
    title: 'cadastros.tile.projects',
    description: 'Listagem das obras (projetos) do cliente, com busca e paginação.',
    tags: ['cadastros', 'obras', 'projetos'],
    entities: ['Project'],
    capabilities: ['Listar obras', 'Buscar por código ou nome', 'Criar, editar e excluir obras'],
    relatedRoutes: [{ path: '/_private/cadastros/obras/add', relation: 'child', description: 'Criar ou editar uma obra' }],
  },
  component: ProjectListPage,
  validateSearch: (search: Record<string, unknown>): SearchParams => searchSchema.parse(search),
});

function ProjectListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate({ from: Route.fullPath });
  const { page = 1, size = 20, search } = useSearch({ from: '/_private/cadastros/obras/' });

  const { data, isLoading } = useProjects({ search, page: page - 1, size });
  const { deleteProject } = useProjectsApi();

  const [deleteId, setDeleteId] = useState<number | null>(null);

  const items = data?.data || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / size);

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteProject.mutateAsync(deleteId);
      toast.success(t('delete.success'));
    } catch {
      // Erros HTTP já geram toast no client da API.
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <Card>
      <CardHeader title={t('cadastros.tile.projects')}>
        <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row">
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
          <Button onClick={() => navigate({ to: '/cadastros/obras/add' })}>
            <Plus className="size-4" />
            {t('add')}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <DefaultLoading />
        ) : items.length === 0 ? (
          <DefaultEmptyData />
        ) : (
          <ItemGroup className="gap-2">
            {items.map((item) => (
              <Item key={item.id} variant="outline" className="cursor-pointer" onClick={() => navigate({ to: '/cadastros/obras/add', search: { id: item.id } })}>
                <ItemContent className="gap-0">
                  <ItemTitle className="text-base">{item.name}</ItemTitle>
                  <ItemDescription>
                    {item.code}
                    {item.context ? ` · ${item.context}` : ''}
                  </ItemDescription>
                </ItemContent>

                <Badge variant={item.active ? 'secondary' : 'outline'}>{item.active ? t('active') : t('inactive')}</Badge>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate({ to: '/cadastros/obras/add', search: { id: item.id } })}>{t('edit')}</DropdownMenuItem>
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

      {totalCount > 0 && (
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
      )}

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
    </Card>
  );
}
