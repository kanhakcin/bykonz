import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Ban,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Cog,
  Image as ImageIcon,
  Images,
  Sparkles,
  TriangleAlert,
  User,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Badge, Button, KPI } from '../components/ui'
import { Shell } from '../components/Shell'
import {
  useAcknowledgeAlert,
  useConfirmMention,
  useDiaryDay,
  useRejectMention,
  useResolveAlert,
} from '../api/client'
import { loadMediaObjectUrl } from '../api/media'
import type { Alert, Entry, Mention, TriageItem } from '../api/types'
import { useToast } from '../providers'

const MENTION_ICON: Partial<Record<Mention['entityType'], LucideIcon>> = {
  PERSON: User,
  MACHINE: Cog,
}

const SOURCE_LABEL: Record<Mention['source'], string> = {
  CODE: 'código',
  AI: 'IA',
  MANUAL: 'manual',
  QR: 'qr',
}

function MentionTag({ mention }: { mention: Mention }) {
  const Icon = MENTION_ICON[mention.entityType]
  return (
    <span className="etag">
      {Icon && <Icon aria-hidden />}
      <span className={mention.entityType === 'PERSON' ? undefined : 'code'}>{mention.label}</span>
      <span className={`pdot${mention.source === 'AI' ? ' ia' : ''}`} aria-hidden />
      <span className="src">{SOURCE_LABEL[mention.source]}</span>
    </span>
  )
}

const STATUS_BADGE: Record<Entry['status'], { variant: 'success' | 'warning' | 'error'; label: string; icon: LucideIcon }> = {
  COMPLIANT: { variant: 'success', label: 'Conforme', icon: CheckCircle2 },
  ALERT: { variant: 'warning', label: 'Alerta', icon: TriangleAlert },
  CRITICAL: { variant: 'error', label: 'Crítico', icon: Ban },
}

function timeOf(dateISO: string) {
  return new Date(dateISO).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function EntryCard({ entry, index }: { entry: Entry; index: number }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [isImageOpen, setIsImageOpen] = useState(false)
  const status = STATUS_BADGE[entry.status]
  const StatusIcon = status.icon
  const cls = entry.status === 'CRITICAL' ? 'crit' : entry.status === 'ALERT' ? 'alert' : ''

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    setThumbUrl(null)
    if (!entry.mediaUrl) {
      return undefined
    }

    loadMediaObjectUrl(entry.mediaUrl)
      .then((url) => {
        objectUrl = url
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        setThumbUrl(url)
      })
      .catch(() => {
        if (!cancelled) {
          setThumbUrl(null)
        }
      })

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [entry.mediaUrl])

  useEffect(() => {
    if (!isImageOpen) {
      return undefined
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsImageOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isImageOpen])

  return (
    <>
      <article className={`panel reg ${cls} reveal`} style={{ animationDelay: `${index * 55}ms` }}>
        <button
          type="button"
          className="thumb"
          disabled={!thumbUrl}
          aria-label="Abrir imagem do registro"
          onClick={() => thumbUrl && setIsImageOpen(true)}
        >
          {thumbUrl ? <img className="thumb-img" src={thumbUrl} alt="" /> : <ImageIcon aria-hidden />}
          <span className="tm">{timeOf(entry.recordedAt)}</span>
        </button>
        <div className="body">
          <div className="cap">{entry.description}</div>
          <div className="tags">
            {entry.mentions.map((m) => (
              <MentionTag key={m.id} mention={m} />
            ))}
          </div>
          <div className="foot">
            <span className="author">
              <span className="av">{entry.author.initials}</span>
              {entry.author.name}
            </span>
            <Badge variant={status.variant}>
              <StatusIcon size={13} aria-hidden /> {status.label}
            </Badge>
          </div>
        </div>
      </article>
      {isImageOpen &&
        thumbUrl &&
        createPortal(
          <div className="img-modal" role="dialog" aria-modal="true" onClick={() => setIsImageOpen(false)}>
            <div className="img-modal-box" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="img-modal-close"
                aria-label="Fechar imagem"
                onClick={() => setIsImageOpen(false)}
              >
                <X aria-hidden />
              </button>
              <img src={thumbUrl} alt={entry.description} />
              <div className="img-modal-caption">
                <span>{timeOf(entry.recordedAt)}</span>
                <strong>{entry.description}</strong>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

function AlertItem({ alert }: { alert: Alert }) {
  const toast = useToast()
  const resolve = useResolveAlert()
  const acknowledge = useAcknowledgeAlert()
  const critical = alert.severity === 'CRITICAL'
  const Icon = critical ? Ban : TriangleAlert
  const busy = resolve.isPending || acknowledge.isPending
  return (
    <div className={`rail-item ${critical ? 'crit' : 'warn'}`}>
      <div className="it-top">
        <div className="it-ic">
          <Icon aria-hidden />
        </div>
        <div>
          <div className="it-t">{alert.title}</div>
          <div className="it-d">{alert.detail}</div>
          <div className="it-ref">{alert.reference}</div>
        </div>
      </div>
      <div className="acts">
        <Button
          variant="blue"
          size="sm"
          icon={Check}
          disabled={busy}
          onClick={() => resolve.mutate(alert.id, { onSuccess: () => toast('Alerta resolvido') })}
        >
          Resolver
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => acknowledge.mutate(alert.id, { onSuccess: () => toast('Alerta ignorado') })}
        >
          Ignorar
        </Button>
      </div>
    </div>
  )
}

function TriageEntry({ item }: { item: TriageItem }) {
  const toast = useToast()
  const confirm = useConfirmMention()
  const reject = useRejectMention()
  const busy = confirm.isPending || reject.isPending
  return (
    <div className="rail-item ia">
      <div className="it-top">
        <div className="it-ic">
          <Sparkles aria-hidden />
        </div>
        <div>
          <div className="it-t">
            {item.matchedText} → {item.suggestion}
          </div>
          <div className="it-d">Citado no texto, sem matrícula. Confirmar a pessoa?</div>
          <div className="it-ref">{item.reference}</div>
        </div>
      </div>
      <div className="acts">
        <Button
          variant="green"
          size="sm"
          icon={Check}
          disabled={busy}
          onClick={() => confirm.mutate(item.id, { onSuccess: () => toast('Vínculo confirmado') })}
        >
          Confirmar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={X}
          disabled={busy}
          onClick={() => reject.mutate(item.id, { onSuccess: () => toast('Vínculo descartado') })}
        >
          Não é
        </Button>
        <span className="conf">conf. {Math.round(item.confidence * 100)}%</span>
      </div>
    </div>
  )
}

export function Painel() {
  const today = useMemo(() => {
    const now = new Date(Date.now() - 3 * 60 * 60 * 1000)
    return now.toISOString().slice(0, 10)
  }, [])
  const { data: day, isLoading, isError, error } = useDiaryDay(today)

  const dateLabel = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return (
    <Shell
      titulo="Painel"
      acoes={
        <>
          {!import.meta.env.VITE_API_URL && <Badge variant="neutral">Dados de demonstração</Badge>}
          <Button variant="default" size="sm" icon={Calendar}>
            Hoje · {dateLabel}
          </Button>
        </>
      }
    >
      {isError ? (
        <p className="muted-txt">Erro ao carregar o diário: {(error as Error).message}</p>
      ) : isLoading || !day ? (
        <p className="muted-txt">Carregando o diário de hoje…</p>
      ) : (
        <>
          <div className="row between" style={{ marginBottom: 14 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16 }}>
                {day.project.name}
              </div>
              <div className="muted-txt" style={{ fontSize: 12.5 }}>
                {[day.project.context, day.project.sector.name].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4" style={{ marginBottom: 22 }}>
            <KPI icon={Images} title="Registros hoje" value={day.kpis.entries} sub="fotos no diário" />
            <KPI
              icon={CheckCircle2}
              title="Conformidade"
              value={day.kpis.compliancePct}
              unit="%"
              sub={`${day.kpis.compliant} de ${day.kpis.entries} sem alerta`}
            />
            <KPI icon={Bell} title="Alertas abertos" value={day.kpis.openAlerts} sub="para tratar" />
            <KPI icon={Sparkles} title="Triagem da IA" value={day.kpis.pendingTriage} sub="a confirmar" />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_340px] items-start">
            <section>
              <div className="row between" style={{ marginBottom: 12 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 18, margin: 0 }}>
                  Diário de hoje
                </h2>
                <span className="muted-txt" style={{ fontSize: 13 }}>
                  {day.kpis.entries} registros · {day.kpis.linkedStandards} normas vinculadas
                </span>
              </div>
              {day.entries.map((entry, i) => (
                <EntryCard key={entry.id} entry={entry} index={i} />
              ))}
              {day.entries.length === 0 && (
                <p className="muted-txt">Nenhum registro hoje — envie fotos pelo WhatsApp para começar.</p>
              )}
            </section>

            <div className="grid gap-4">
              <section className="panel">
                <div className="panel-head">
                  <span className="h">
                    <Bell style={{ color: '#d97706' }} aria-hidden /> Alertas abertos
                  </span>
                  <span className="sub">{day.alerts.length}</span>
                </div>
                {day.alerts.length === 0 ? (
                  <div className="rail-empty">
                    <CheckCircle2 aria-hidden />
                    Nenhum alerta em aberto.
                  </div>
                ) : (
                  <div style={{ paddingBottom: 2 }}>
                    {day.alerts.map((a) => (
                      <AlertItem key={a.id} alert={a} />
                    ))}
                  </div>
                )}
              </section>

              <section className="panel">
                <div className="panel-head">
                  <span className="h">
                    <Sparkles style={{ color: 'var(--brand-blue)' }} aria-hidden /> Triagem da IA
                  </span>
                  <span className="sub">{day.triage.length}</span>
                </div>
                {day.triage.length === 0 ? (
                  <div className="rail-empty">
                    <CheckCircle2 aria-hidden />
                    Nada para confirmar.
                  </div>
                ) : (
                  <div style={{ paddingBottom: 2 }}>
                    {day.triage.map((t) => (
                      <TriageEntry key={t.id} item={t} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </Shell>
  )
}
