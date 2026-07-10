import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DefaultEmptyData from '@/components/default-empty-data';
import DefaultLoading from '@/components/default-loading';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useProjectFilter } from '@/hooks/use-project-filter';
import { useProjectsSelect } from '@/hooks/use-projects-api';
import { ObraCard } from '@/routes/_private/@components/obra-card';

/**
 * Home do app: galeria das obras ativas. A URL raiz (/) sempre mostra os cards;
 * escolher uma obra leva ao painel dela.
 */
export const Route = createFileRoute('/_private/')({
  staticData: {
    title: 'obras.select.title',
    description: 'Home: galeria de seleção da obra ativa. Escolha qual obra visualizar no painel.',
    tags: ['obras', 'seleção', 'home', 'painel'],
    entities: ['Project'],
    capabilities: ['Selecionar a obra ativa do painel', 'Buscar obra por nome ou código'],
    relatedRoutes: [{ path: '/_private/painel', relation: 'child', description: 'Painel da obra selecionada' }],
  },
  component: ObraSelectPage,
});

function ObraSelectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setProjectId = useProjectFilter((state) => state.setProjectId);

  const { data: obras, isLoading } = useProjectsSelect();

  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return obras ?? [];
    return (obras ?? []).filter((obra) => obra.name.toLowerCase().includes(term) || obra.code.toLowerCase().includes(term));
  }, [obras, search]);

  const handleSelect = (id: number) => {
    setProjectId(id);
    navigate({ to: '/painel' });
  };

  return (
    <Card>
      <CardHeader title={t('obras.select.title')}>
        <div className="relative w-full sm:max-w-64">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('search')} className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <DefaultLoading />
        ) : filtered.length === 0 ? (
          <DefaultEmptyData />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((obra) => (
              <ObraCard key={obra.id} obra={obra} onSelect={handleSelect} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
