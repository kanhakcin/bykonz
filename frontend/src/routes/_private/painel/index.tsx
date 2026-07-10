import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { Bell, CalendarDays, CheckCircle2, Images, RefreshCw, Repeat, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DefaultEmptyData from '@/components/default-empty-data';
import { DefaultKPI } from '@/components/default-KPI';
import DefaultLoading from '@/components/default-loading';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDiaryDay } from '@/hooks/use-diary-api';
import { useProjectFilter } from '@/hooks/use-project-filter';
import { formatDate, getDateLocale } from '@/lib/helpers/format-date.helper';
import { AlertsPanel } from '@/routes/_private/painel/@components/alerts-panel';
import { EntryCard } from '@/routes/_private/painel/@components/entry-card';
import { TriagePanel } from '@/routes/_private/painel/@components/triage-panel';

export const Route = createFileRoute('/_private/painel/')({
  // Sem obra escolhida, volta para a home (galeria de seleção).
  beforeLoad: () => {
    if (useProjectFilter.getState().projectId === undefined) {
      throw redirect({ to: '/' });
    }
  },
  component: PainelPage,
});

// Diário considera o dia útil como 00h-24h no fuso de Brasília (UTC-3).
// A string YYYY-MM-DD é o contrato com o backend; convertemos para/de Date
// usando componentes locais para o calendário não deslocar o dia por fuso.
function panelTodayISO(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isoToDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function PainelPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const projectId = useProjectFilter((state) => state.projectId);

  const today = useMemo(() => panelTodayISO(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const isToday = selectedDate === today;

  const { data: day, isLoading, isError, isFetching, refetch } = useDiaryDay(selectedDate, projectId);

  const entriesTitle = isToday ? t('painel.entries.title') : t('painel.entries.forDate', { date: formatDate(isoToDate(selectedDate), 'PP') });

  return (
    <Card>
      <CardHeader title={t('painel.title')}>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" aria-label={t('painel.filterDate')}>
                <CalendarDays className="size-4" />
                {formatDate(isoToDate(selectedDate), 'PP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={isoToDate(selectedDate)}
                onSelect={(date) => date && setSelectedDate(dateToISO(date))}
                disabled={{ after: isoToDate(today) }}
                locale={getDateLocale()}
                autoFocus
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={() => navigate({ to: '/' })}>
            <Repeat className="size-4" />
            {t('obras.switch')}
          </Button>
          <Button variant="ghost" size="icon" aria-label={t('update')} disabled={isFetching} onClick={() => refetch()}>
            <RefreshCw className={isFetching ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </div>
      </CardHeader>
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
                  <h2 className="font-semibold text-base">{entriesTitle}</h2>
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
