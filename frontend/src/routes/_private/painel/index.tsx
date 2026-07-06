import { createFileRoute } from '@tanstack/react-router';
import { Bell, CheckCircle2, Images, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import DefaultEmptyData from '@/components/default-empty-data';
import DefaultLoading from '@/components/default-loading';
import { DefaultKPI } from '@/components/default-KPI';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useDiaryDay } from '@/hooks/use-diary-api';
import { AlertsPanel } from '@/routes/_private/painel/@components/alerts-panel';
import { EntryCard } from '@/routes/_private/painel/@components/entry-card';
import { TriagePanel } from '@/routes/_private/painel/@components/triage-panel';

export const Route = createFileRoute('/_private/painel/')({
  component: PainelPage,
});

function PainelPage() {
  const { t } = useTranslation();

  // Diário considera o dia útil como 00h-24h no fuso de Brasília (UTC-3).
  const today = useMemo(() => {
    const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
    return now.toISOString().slice(0, 10);
  }, []);

  const { data: day, isLoading, isError } = useDiaryDay(today);

  return (
    <Card>
      <CardHeader title={t('painel.title')} />
      <CardContent>
        {isLoading ? (
          <DefaultLoading />
        ) : isError || !day ? (
          <DefaultEmptyData />
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-base">{day.project.name}</div>
                <div className="text-muted-foreground text-xs">{[day.project.context, day.project.sector.name].filter(Boolean).join(' · ')}</div>
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <DefaultKPI icon={Images} title={t('painel.kpi.entries')} value={day.kpis.entries} />
              <DefaultKPI icon={CheckCircle2} title={t('painel.kpi.compliance')} value={`${day.kpis.compliancePct}%`} />
              <DefaultKPI icon={Bell} title={t('painel.kpi.openAlerts')} value={day.kpis.openAlerts} />
              <DefaultKPI icon={Sparkles} title={t('painel.kpi.pendingTriage')} value={day.kpis.pendingTriage} />
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-base">{t('painel.entries.title')}</h2>
                  <span className="text-muted-foreground text-xs">{t('painel.entries.summary', { count: day.kpis.entries, standards: day.kpis.linkedStandards })}</span>
                </div>
                {day.entries.length === 0 ? (
                  <p className="text-muted-foreground text-sm">{t('painel.entries.empty')}</p>
                ) : (
                  day.entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)
                )}
              </section>

              <div className="flex flex-col gap-4">
                <AlertsPanel alerts={day.alerts} />
                <TriagePanel items={day.triage} />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
