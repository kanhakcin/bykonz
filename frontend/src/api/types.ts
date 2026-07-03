/**
 * Manager-panel API contract — v1 (English).
 *
 * Mirrors the backend REST API (src/api/panelRouter.ts) built on the v1 data
 * architecture (entries, entry_mentions with source/confidence, alerts as
 * snapshots). Implementations: http.ts (real API) and mock.ts (demo data).
 */

export type MentionSource = 'CODE' | 'AI' | 'MANUAL' | 'QR'

export type EntityType = 'STANDARD' | 'PERSON' | 'MACHINE' | 'ASSET'

export type AlertType =
  | 'PERSON_NOT_TRAINED'
  | 'MACHINE_NO_INSPECTION'
  | 'MACHINE_INSPECTION_EXPIRED'
  | 'STANDARD_NOT_FOUND'

export type AlertSeverity = 'WARNING' | 'CRITICAL'

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'

/** Entry situation derived from its open alerts. */
export type EntryStatus = 'COMPLIANT' | 'ALERT' | 'CRITICAL'

export interface Mention {
  id: number
  entityType: EntityType
  entityId: number | null
  /** Display label — e.g. "PS-024", "José Pereira" */
  label: string
  source: MentionSource
  /** 0–1; present when source = AI */
  confidence: number | null
  confirmed: boolean
}

export interface Entry {
  id: number
  /** ISO 8601 */
  recordedAt: string
  description: string
  author: { name: string; initials: string }
  mentions: Mention[]
  status: EntryStatus
  mediaUrl: string | null
  mediaCount: number
}

export interface Alert {
  id: number
  entryId: number
  type: AlertType
  severity: AlertSeverity
  title: string
  detail: string | null
  /** Display reference — e.g. "Registro 09:16 · MAT-118" */
  reference: string
  status: AlertStatus
}

/** AI mention awaiting manager confirmation. */
export interface TriageItem {
  id: number
  entryId: number
  /** Matched text — e.g. '"José"' */
  matchedText: string
  /** Link suggestion — e.g. "José Pereira (MAT-118)" */
  suggestion: string
  confidence: number
  reference: string
}

export interface DayKpis {
  entries: number
  compliant: number
  compliancePct: number
  openAlerts: number
  pendingTriage: number
  linkedStandards: number
}

export interface Project {
  id: number
  name: string
  /** Current context shown under the name — e.g. "Apto 1403 · Laje tipo 04" */
  context: string | null
  sector: { code: string; name: string }
}

/** Aggregated payload of the "diary of the day" view. */
export interface DiaryDay {
  date: string
  project: Project
  kpis: DayKpis
  entries: Entry[]
  alerts: Alert[]
  triage: TriageItem[]
}

export interface User {
  name: string
  initials: string
  role: string
  email: string
}

/** Data access port — implemented by the HTTP client and the mock. */
export interface DiaryApi {
  login(email: string, password: string): Promise<User>
  getDiaryDay(dateISO: string): Promise<DiaryDay>
  resolveAlert(alertId: number): Promise<void>
  acknowledgeAlert(alertId: number): Promise<void>
  confirmMention(mentionId: number): Promise<void>
  rejectMention(mentionId: number): Promise<void>
}
