import { createFileRoute } from '@tanstack/react-router';
import { CalendarRange, FileText, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DataSelect } from '@/components/ui/data-select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useDownloadDailyReport } from '@/hooks/use-daily-report-api';
import { useProjectsSelect } from '@/hooks/use-projects-api';
import { cn } from '@/lib/utils/cn.util';

export const Route = createFileRoute('/_private/relatorios/')({
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const { t } = useTranslation();

  const TILES = [
    { icon: FileText, labelKey: 'relatorios.tile.dailyPdf', dialog: <DailyPdfDialog /> },
    { icon: CalendarRange, labelKey: 'relatorios.tile.byPeriod' },
    { icon: TriangleAlert, labelKey: 'relatorios.tile.alerts' },
  ];

  return (
    <Card>
      <CardHeader title={t('relatorios.title')} />
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map(({ icon: Icon, labelKey, dialog }) => {
            const tile = (
              <Empty key={labelKey} className={cn('h-full border-2 bg-accent/30', dialog ? 'cursor-pointer transition-colors hover:border-primary/50' : 'opacity-60')}>
                <EmptyHeader>
                  <EmptyMedia>
                    <Icon className="size-5" aria-hidden />
                  </EmptyMedia>
                  <EmptyTitle>{t(labelKey)}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            );

            if (!dialog) {
              return tile;
            }

            return (
              <Dialog key={labelKey}>
                <DialogTrigger asChild>{tile}</DialogTrigger>
                {dialog}
              </Dialog>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function DailyPdfDialog() {
  const { t } = useTranslation();
  const projectsQuery = useProjectsSelect();
  const downloadReport = useDownloadDailyReport();

  const today = useMemo(() => {
    const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
    return now.toISOString().slice(0, 10);
  }, []);

  const [projectId, setProjectId] = useState<number>();
  const [date, setDate] = useState(today);

  const handleGenerate = async () => {
    if (!projectId) return;

    try {
      const blob = await downloadReport.mutateAsync({ projectId, date });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `diario-obra-${projectId}-${date}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      // Erros HTTP já geram toast no client da API.
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('relatorios.tile.dailyPdf')}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>{t('relatorios.dailyPdf.project')}</Label>
          <DataSelect
            placeholder={t('select.placeholder')}
            searchPlaceholder={t('search')}
            value={projectId}
            onChange={(value) => setProjectId(typeof value === 'number' ? value : undefined)}
            query={projectsQuery}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t('relatorios.dailyPdf.date')}</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={today} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleGenerate} disabled={!projectId || downloadReport.isPending}>
          {downloadReport.isPending && <Spinner className="size-4" />}
          {t('relatorios.dailyPdf.download')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
