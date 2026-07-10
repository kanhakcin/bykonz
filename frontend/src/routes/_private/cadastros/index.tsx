import { createFileRoute, Link } from '@tanstack/react-router';
import { Building2, FileBadge, Package, ShieldCheck, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { useAuth } from '@/hooks/use-auth';

const TILES = [
  { icon: Building2, labelKey: 'cadastros.tile.projects', to: '/cadastros/obras' as const },
  { icon: FileBadge, labelKey: 'cadastros.tile.standards', to: '/cadastros/normas' as const },
  { icon: ShieldCheck, labelKey: 'cadastros.tile.panelUsers', to: '/cadastros/usuarios' as const, adminOnly: true },
  { icon: Package, labelKey: 'cadastros.tile.assets', to: '/cadastros/ativos' as const },
  { icon: Users, labelKey: 'cadastros.tile.people', to: '/cadastros/pessoas' as const },
];

export const Route = createFileRoute('/_private/cadastros/')({
  staticData: {
    title: 'cadastros.title',
    description: 'Hub de cadastros: obras, normas, usuários do painel, pessoas & competências, máquinas & vistorias e ativos.',
    tags: ['cadastros', 'obras', 'normas', 'usuarios', 'pessoas', 'maquinas', 'ativos'],
    relatedRoutes: [
      { path: '/_private/cadastros/obras', relation: 'child', description: 'Cadastro de obras (projetos)' },
      { path: '/_private/cadastros/normas', relation: 'child', description: 'Cadastro de normas e procedimentos' },
      { path: '/_private/cadastros/ativos', relation: 'child', description: 'Cadastro de ativos (objetos vistoriáveis)' },
      { path: '/_private/cadastros/pessoas', relation: 'child', description: 'Cadastro de pessoas (força de trabalho)' },
      { path: '/_private/cadastros/usuarios', relation: 'child', description: 'Cadastro de usuários com acesso ao painel' },
    ],
    capabilities: [
      'Navegar para o cadastro de obras',
      'Navegar para o cadastro de normas',
      'Navegar para o cadastro de ativos',
      'Navegar para o cadastro de pessoas',
      'Navegar para o cadastro de usuários do painel',
    ],
  },
  component: CadastrosPage,
});

function CadastrosPage() {
  const { t } = useTranslation();
  const isAdmin = useAuth((state) => state.user?.role === 'ADMIN');
  const visibleTiles = TILES.filter((tile) => !tile.adminOnly || isAdmin);

  return (
    <Card>
      <CardHeader title={t('cadastros.title')} />
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visibleTiles.map(({ icon: Icon, labelKey, to }) => {
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
