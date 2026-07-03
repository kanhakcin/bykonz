/**
 * Adaptador mock do contrato DiaryApi — dados ilustrativos (setor civil).
 * Usado quando VITE_API_URL não está definido (ver client.ts); os textos de
 * demonstração continuam pt-BR, como no produto.
 */

import type { Alert, DiaryDay, DiaryApi, Entry, TriageItem, User } from './types'

const LATENCY_MS = 350

const user: User = {
  name: 'Ricardo Tanen',
  initials: 'RT',
  role: 'Gestor de obra',
  email: 'ricardo@tanen.com.br',
}

const entries: Entry[] = [
  {
    id: 1,
    recordedAt: '2026-07-03T09:14:00-03:00',
    description: 'Grauteamento da canaleta inferior — cozinha, apto 1403, laje tipo 04, lado esquerdo.',
    author: { name: 'Eng. Marina Alves', initials: 'MA' },
    mentions: [
      { id: 11, entityType: 'STANDARD', entityId: 24, label: 'PS-024', source: 'CODE', confidence: null, confirmed: true },
    ],
    status: 'COMPLIANT',
    mediaUrl: null,
    mediaCount: 1,
  },
  {
    id: 2,
    recordedAt: '2026-07-03T09:16:00-03:00',
    description: 'José está realizando o grauteamento da canaleta inferior.',
    author: { name: 'Eng. Marina Alves', initials: 'MA' },
    mentions: [
      { id: 21, entityType: 'STANDARD', entityId: 24, label: 'PS-024', source: 'CODE', confidence: null, confirmed: true },
      { id: 22, entityType: 'PERSON', entityId: 118, label: 'José Pereira', source: 'AI', confidence: 0.82, confirmed: false },
    ],
    status: 'ALERT',
    mediaUrl: null,
    mediaCount: 1,
  },
  {
    id: 3,
    recordedAt: '2026-07-03T09:21:00-03:00',
    description: 'Impermeabilização da laje técnica.',
    author: { name: 'Eng. Marina Alves', initials: 'MA' },
    mentions: [
      { id: 31, entityType: 'STANDARD', entityId: 31, label: 'PS-031', source: 'CODE', confidence: null, confirmed: true },
    ],
    status: 'COMPLIANT',
    mediaUrl: null,
    mediaCount: 1,
  },
  {
    id: 4,
    recordedAt: '2026-07-03T10:02:00-03:00',
    description: 'Misturadora de cimento em operação no pavimento 14.',
    author: { name: 'Téc. Paulo Reis', initials: 'PR' },
    mentions: [
      { id: 41, entityType: 'MACHINE', entityId: 7, label: 'MX-007', source: 'CODE', confidence: null, confirmed: true },
    ],
    status: 'CRITICAL',
    mediaUrl: null,
    mediaCount: 1,
  },
]

const alerts: Alert[] = [
  {
    id: 1,
    entryId: 2,
    type: 'PERSON_NOT_TRAINED',
    severity: 'WARNING',
    title: 'José Pereira não treinado',
    detail: 'Competência ausente para a norma PS-024.',
    reference: 'Registro 09:16 · MAT-118',
    status: 'OPEN',
  },
  {
    id: 2,
    entryId: 4,
    type: 'MACHINE_INSPECTION_EXPIRED',
    severity: 'CRITICAL',
    title: 'Misturadora MX-007 — vistoria vencida',
    detail: 'Última vistoria em 02/05 · validade de 30 dias.',
    reference: 'Registro 10:02',
    status: 'OPEN',
  },
]

const triage: TriageItem[] = [
  {
    id: 22,
    entryId: 2,
    matchedText: '"José"',
    suggestion: 'José Pereira (MAT-118)',
    confidence: 0.82,
    reference: 'Registro 09:16',
  },
]

const state = {
  entries: entries.map((e) => ({ ...e, mentions: [...e.mentions] })),
  alerts: [...alerts],
  triage: [...triage],
}

const delay = () => new Promise<void>((r) => setTimeout(r, LATENCY_MS))

function entryStatus(entry: Entry): Entry['status'] {
  const open = state.alerts.filter((a) => a.entryId === entry.id && a.status === 'OPEN')
  if (open.some((a) => a.severity === 'CRITICAL')) return 'CRITICAL'
  if (open.length > 0) return 'ALERT'
  return 'COMPLIANT'
}

function buildDay(dateISO: string): DiaryDay {
  const dayEntries = state.entries.map((e) => ({ ...e, status: entryStatus(e) }))
  const open = state.alerts.filter((a) => a.status === 'OPEN')
  const compliant = dayEntries.filter((e) => e.status === 'COMPLIANT').length
  const standards = new Set(
    dayEntries.flatMap((e) => e.mentions.filter((m) => m.entityType === 'STANDARD').map((m) => m.label)),
  )
  return {
    date: dateISO,
    project: {
      id: 1,
      name: 'Obra Residencial Aurora',
      context: 'Apto 1403 · Laje tipo 04',
      sector: { code: 'CIVIL', name: 'Construção civil' },
    },
    kpis: {
      entries: dayEntries.length,
      compliant,
      compliancePct: dayEntries.length ? Math.round((compliant / dayEntries.length) * 100) : 100,
      openAlerts: open.length,
      pendingTriage: state.triage.length,
      linkedStandards: standards.size,
    },
    entries: dayEntries,
    alerts: open,
    triage: [...state.triage],
  }
}

export const mockApi: DiaryApi = {
  async login(email) {
    await delay()
    return { ...user, email }
  },

  async getDiaryDay(dateISO) {
    await delay()
    return buildDay(dateISO)
  },

  async resolveAlert(alertId) {
    await delay()
    const alert = state.alerts.find((a) => a.id === alertId)
    if (alert) alert.status = 'RESOLVED'
  },

  async acknowledgeAlert(alertId) {
    await delay()
    const alert = state.alerts.find((a) => a.id === alertId)
    if (alert) alert.status = 'ACKNOWLEDGED'
  },

  async confirmMention(mentionId) {
    await delay()
    for (const entry of state.entries) {
      const mention = entry.mentions.find((m) => m.id === mentionId)
      if (mention) mention.confirmed = true
    }
    state.triage = state.triage.filter((t) => t.id !== mentionId)
  },

  async rejectMention(mentionId) {
    await delay()
    for (const entry of state.entries) {
      entry.mentions = entry.mentions.filter((m) => m.id !== mentionId)
    }
    state.triage = state.triage.filter((t) => t.id !== mentionId)
  },
}
