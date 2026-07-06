import { createFileRoute, Link } from '@tanstack/react-router';
import { Building2, Cog, FileBadge, Package, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

const TILES = [
  { icon: Building2, labelKey: 'cadastros.tile.projects', to: '/cadastros/obras' as const },
  { icon: FileBadge, labelKey: 'cadastros.tile.standards', to: '/cadastros/normas' as const },
  { icon: Users, labelKey: 'cadastros.tile.people' },
  { icon: Cog, labelKey: 'cadastros.tile.machines' },
  { icon: Package, labelKey: 'cadastros.tile.assets' },
];

export const Route = createFileRoute('/_private/cadastros/')({
  staticData: {
    title: 'cadastros.title',
    description: 'Hub de cadastros: obras, normas, pessoas & competências, máquinas & vistorias e ativos.',
    tags: ['cadastros', 'obras', 'normas', 'pessoas', 'maquinas', 'ativos'],
    relatedRoutes: [
      { path: '/_private/cadastros/obras', relation: 'child', description: 'Cadastro de obras (projetos)' },
      { path: '/_private/cadastros/normas', relation: 'child', description: 'Cadastro de normas e procedimentos' },
    ],
    capabilities: ['Navegar para o cadastro de obras', 'Navegar para o cadastro de normas'],
  },
  component: CadastrosPage,
});

function CadastrosPage() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader title={t('cadastros.title')} />
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TILES.map(({ icon: Icon, labelKey, to }) => {
            const tile = (
              <Empty key={labelKey} className={`h-full border-2 bg-accent/30 ${to ? 'transition-colors hover:border-primary/50' : 'opacity-60'}`}>
                <EmptyHeader>
                  <EmptyMedia>
                    <Icon className="size-5" aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>{t(labelKey)}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            );

            return to ? (
              <Link key={labelKey} to={to}>
                {tile}
              </Link>
            ) : (
              tile
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
