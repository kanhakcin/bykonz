import { Ban, Bell, Check, CheckCircle2, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { useAcknowledgeAlert, useResolveAlert } from '@/hooks/use-diary-api';
import type { Alert } from '@/routes/_private/painel/@interface/diary';

function AlertRow({ alert }: { alert: Alert }) {
  const { t } = useTranslation();
  const resolve = useResolveAlert();
  const acknowledge = useAcknowledgeAlert();
  const critical = alert.severity === 'CRITICAL';
  const Icon = critical ? Ban : TriangleAlert;
  const busy = resolve.isPending || acknowledge.isPending;

  return (
    <Item variant="outline" className={critical ? 'border-destructive/40' : 'border-amber-500/40'}>
      <ItemContent className="gap-2">
        <div className="flex items-start gap-2">
          <Icon className={critical ? 'mt-0.5 size-4 text-destructive' : 'mt-0.5 size-4 text-amber-500'} aria-hidden />
          <div className="flex flex-col gap-0.5">
            <ItemTitle>{alert.title}</ItemTitle>
            {alert.detail && <ItemDescription>{alert.detail}</ItemDescription>}
            <span className="text-muted-foreground text-xs">{alert.reference}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="blue" size="sm" disabled={busy} onClick={() => resolve.mutate(alert.id)}>
            <Check className="size-3.5" /> {t('painel.alert.resolve')}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => acknowledge.mutate(alert.id)}>
            {t('painel.alert.acknowledge')}
          </Button>
        </div>
      </ItemContent>
    </Item>
  );
}

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Bell className="size-4 text-amber-600" aria-hidden /> {t('painel.alerts.title')}
        </span>
        <span className="text-muted-foreground text-xs">{alerts.length}</span>
      </div>
      {alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground text-sm">
          <CheckCircle2 className="size-5" aria-hidden />
          {t('painel.alerts.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {alerts.map((alert) => (
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </section>
  );
}
