import { Check, CheckCircle2, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Item, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item';
import { useConfirmMention, useRejectMention } from '@/hooks/use-diary-api';
import type { TriageItem } from '@/routes/_private/painel/@interface/diary';

function TriageRow({ item }: { item: TriageItem }) {
  const { t } = useTranslation();
  const confirm = useConfirmMention();
  const reject = useRejectMention();
  const busy = confirm.isPending || reject.isPending;

  return (
    <Item variant="outline" className="border-primary/40">
      <ItemContent className="gap-2">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 text-primary" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <ItemTitle>
              {item.matchedText} → {item.suggestion}
            </ItemTitle>
            <ItemDescription>{t('painel.triage.description')}</ItemDescription>
            <span className="text-muted-foreground text-xs">{item.reference}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="green" size="sm" disabled={busy} onClick={() => confirm.mutate(item.id)}>
            <Check className="size-3.5" /> {t('painel.triage.confirm')}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => reject.mutate(item.id)}>
            <X className="size-3.5" /> {t('painel.triage.reject')}
          </Button>
          <span className="ml-auto text-muted-foreground text-xs">{t('painel.triage.confidence', { value: Math.round(item.confidence * 100) })}</span>
        </div>
      </ItemContent>
    </Item>
  );
}

export function TriagePanel({ items }: { items: TriageItem[] }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Sparkles className="size-4 text-primary" aria-hidden /> {t('painel.triage.title')}
        </span>
        <span className="text-muted-foreground text-xs">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground text-sm">
          <CheckCircle2 className="size-5" aria-hidden />
          {t('painel.triage.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <TriageRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
