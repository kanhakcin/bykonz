import type { LucideIcon } from 'lucide-react';
import { Ban, CheckCircle2, Cog, Image as ImageIcon, Pencil, PencilLine, TriangleAlert, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useUpdateEntryDescription } from '@/hooks/use-diary-api';
import { loadMediaObjectUrl } from '@/lib/api/media';
import { formatDate } from '@/lib/helpers/format-date.helper';
import { cn } from '@/lib/utils/cn.util';
import type { Entry, Mention } from '@/routes/_private/painel/@interface/diary';

/** Espelha MAX_DESCRIPTION_LENGTH do backend (src/api/panelRouter.ts). */
const MAX_DESCRIPTION_LENGTH = 2000;

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

/** Selo de texto corrigido no painel — o registro do bot em si é imutável. */
function EditedBadge({ entry }: { entry: Entry }) {
  const { t } = useTranslation();
  if (!entry.editedAt) return null;

  const when = formatDate(new Date(entry.editedAt), 'Pp');
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
            <PencilLine className="size-3.5" aria-hidden />
            {t('painel.entry.edited')}
          </span>
        </TooltipTrigger>
        <TooltipContent>{entry.editedBy ? t('painel.entry.editedBy', { name: entry.editedBy, date: when }) : when}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function EntryCard({ entry }: { entry: Entry }) {
  const { t } = useTranslation();
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const updateDescription = useUpdateEntryDescription();
  const status = STATUS_BADGE[entry.status];
  const StatusIcon = status.icon;
  const isEditing = draft !== null;
  const trimmedDraft = draft?.trim() ?? '';
  const canSave = trimmedDraft !== '' && trimmedDraft !== entry.description && trimmedDraft.length <= MAX_DESCRIPTION_LENGTH;

  async function saveDraft() {
    if (!canSave) return;
    try {
      await updateDescription.mutateAsync({ id: entry.id, description: trimmedDraft });
      setDraft(null);
      // O registro continua no dia original: o PDF já enviado só muda se for gerado de novo.
      toast.success(t('painel.entry.editSaved'));
    } catch {
      // Erros HTTP já geram toast no client da API.
    }
  }

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
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={MAX_DESCRIPTION_LENGTH} rows={3} autoFocus aria-label={t('description')} />
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={!canSave || updateDescription.isPending} onClick={saveDraft}>
                {t('save')}
              </Button>
              <Button size="sm" variant="ghost" disabled={updateDescription.isPending} onClick={() => setDraft(null)}>
                {t('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm">{entry.description}</div>
            <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={t('painel.entry.editDescription')} onClick={() => setDraft(entry.description)}>
              <Pencil className="size-3.5" aria-hidden />
            </Button>
          </div>
        )}
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
          <div className="flex items-center gap-2">
            <EditedBadge entry={entry} />
            <Badge variant={status.variant}>
              <StatusIcon size={13} aria-hidden /> {t(status.labelKey)}
            </Badge>
          </div>
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
