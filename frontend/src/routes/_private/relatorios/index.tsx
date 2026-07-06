import { createFileRoute } from '@tanstack/react-router';
import { CalendarRange, FileText, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

const TILES = [
  { icon: FileText, labelKey: 'relatorios.tile.dailyPdf' },
  { icon: CalendarRange, labelKey: 'relatorios.tile.byPeriod' },
  { icon: TriangleAlert, labelKey: 'relatorios.tile.alerts' },
];

export const Route = createFileRoute('/_private/relatorios/')({
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader title={t('relatorios.title')} />
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
