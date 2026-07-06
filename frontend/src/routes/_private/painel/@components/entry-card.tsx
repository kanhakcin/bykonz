import type { LucideIcon } from 'lucide-react';
import { Ban, CheckCircle2, Cog, Image as ImageIcon, TriangleAlert, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { loadMediaObjectUrl } from '@/lib/api/media';
import { cn } from '@/lib/utils/cn.util';
import type { Entry, Mention } from '@/routes/_private/painel/@interface/diary';

const MENTION_ICON: Partial<Record<Mention['entityType'], LucideIcon>> = {
  PERSON: User,
  MACHINE: Cog,
};

const SOURCE_LABEL_KEY: Record<Mention['source'], string> = {
  CODE: 'painel.mention.source.code',
  AI: 'painel.mention.source.ai',
  MANUAL: 'painel.mention.source.manual',
  QR: 'painel.mention.source.qr',
};

const STATUS_BADGE: Record<Entry['status'], { variant: 'success' | 'warning' | 'error'; labelKey: string; icon: LucideIcon }> = {
  COMPLIANT: { variant: 'success', labelKey: 'painel.status.compliant', icon: CheckCircle2 },
  ALERT: { variant: 'warning', labelKey: 'painel.status.alert', icon: TriangleAlert },
  CRITICAL: { variant: 'error', labelKey: 'painel.status.critical', icon: Ban },
};

function MentionTag({ mention }: { mention: Mention }) {
  const { t } = useTranslation();
  const Icon = MENTION_ICON[mention.entityType];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border bg-accent/40 px-2 py-1 text-xs">
      {Icon && <Icon className="size-3.5" aria-hidden />}
      <span className={mention.entityType === 'PERSON' ? undefined : 'font-mono'}>{mention.label}</span>
      <span className={mention.source === 'AI' ? 'text-primary' : 'text-muted-foreground'}>{t(SOURCE_LABEL_KEY[mention.source])}</span>
    </span>
  );
}

function timeOf(dateISO: string) {
  return new Date(dateISO).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function EntryCard({ entry }: { entry: Entry }) {
  const { t } = useTranslation();
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const status = STATUS_BADGE[entry.status];
  const StatusIcon = status.icon;

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setThumbUrl(null);
    if (!entry.mediaUrl) return undefined;

    loadMediaObjectUrl(entry.mediaUrl)
      .then((url) => {
        objectUrl = url;
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setThumbUrl(url);
      })
      .catch(() => {
        if (!cancelled) setThumbUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entry.mediaUrl]);

  return (
    <article className="flex gap-3 rounded-lg border bg-background p-3">
      <button
        type="button"
        className={cn(
          'relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-accent/30 transition-all duration-150',
          thumbUrl && 'cursor-pointer hover:scale-[1.03] hover:border-primary hover:shadow-sm',
        )}
        disabled={!thumbUrl}
        aria-label={t('painel.entry.openImage')}
        onClick={() => thumbUrl && setIsImageOpen(true)}
      >
        {thumbUrl ? <img className="size-full object-cover" src={thumbUrl} alt="" /> : <ImageIcon className="size-6 text-muted-foreground" aria-hidden />}
        <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1 font-mono text-[10px]">{timeOf(entry.recordedAt)}</span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="text-sm">{entry.description}</div>
        <div className="flex flex-wrap gap-1.5">
          {entry.mentions.map((m) => (
            <MentionTag key={m.id} mention={m} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <span className="flex size-5 items-center justify-center rounded-full bg-accent font-medium text-[10px]">{entry.author.initials}</span>
            {entry.author.name}
          </span>
          <Badge variant={status.variant}>
            <StatusIcon size={13} aria-hidden /> {t(status.labelKey)}
          </Badge>
        </div>
      </div>

      <Dialog open={isImageOpen} onOpenChange={setIsImageOpen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="sr-only">{entry.description}</DialogTitle>
          {thumbUrl && <img src={thumbUrl} alt={entry.description} className="w-full rounded-md" />}
          <div className="flex items-center justify-between text-muted-foreground text-sm">
            <span>{timeOf(entry.recordedAt)}</span>
            <strong className="text-foreground">{entry.description}</strong>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
