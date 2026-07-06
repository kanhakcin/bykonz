import { createFileRoute } from '@tanstack/react-router';
import { Cog, FileBadge, Package, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

const TILES = [
  { icon: FileBadge, labelKey: 'cadastros.tile.standards' },
  { icon: Users, labelKey: 'cadastros.tile.people' },
  { icon: Cog, labelKey: 'cadastros.tile.machines' },
  { icon: Package, labelKey: 'cadastros.tile.assets' },
];

export const Route = createFileRoute('/_private/cadastros/')({
  component: CadastrosPage,
});

function CadastrosPage() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader title={t('cadastros.title')} />
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TILES.map(({ icon: Icon, labelKey }) => (
            <Empty key={labelKey} className="border-2 bg-accent/30">
              <EmptyHeader>
                <EmptyMedia>
                  <Icon className="size-5" aria-hidden />
                </EmptyMedia>
                <EmptyTitle>{t(labelKey)}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
