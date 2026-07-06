/**
 * Manager-panel API contract — v1 (English).
 * Espelha o backend REST (src/api/panelRouter.ts na raiz do repo).
 */

export type MentionSource = 'CODE' | 'AI' | 'MANUAL' | 'QR';

export type EntityType = 'STANDARD' | 'PERSON' | 'MACHINE' | 'ASSET';

export type AlertType = 'PERSON_NOT_TRAINED' | 'MACHINE_NO_INSPECTION' | 'MACHINE_INSPECTION_EXPIRED' | 'STANDARD_NOT_FOUND';

export type AlertSeverity = 'WARNING' | 'CRITICAL';

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

/** Situação do registro derivada de seus alertas em aberto. */
export type EntryStatus = 'COMPLIANT' | 'ALERT' | 'CRITICAL';

export interface Mention {
  id: number;
  entityType: EntityType;
  entityId: number | null;
  /** Rótulo de exibição — ex: "PS-024", "José Pereira" */
  label: string;
  source: MentionSource;
  /** 0–1; presente quando source = AI */
  confidence: number | null;
  confirmed: boolean;
}

export interface Entry {
  id: number;
  /** ISO 8601 */
  recordedAt: string;
  description: string;
  author: { name: string; initials: string };
  mentions: Mention[];
  status: EntryStatus;
  mediaUrl: string | null;
  mediaCount: number;
}

export interface Alert {
  id: number;
  entryId: number;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  detail: string | null;
  /** Referência de exibição — ex: "Registro 09:16 · MAT-118" */
  reference: string;
  status: AlertStatus;
}

/** Menção sugerida pela IA aguardando confirmação do gestor. */
export interface TriageItem {
  id: number;
  entryId: number;
  /** Texto identificado — ex: '"José"' */
  matchedText: string;
  /** Sugestão de vínculo — ex: "José Pereira (MAT-118)" */
  suggestion: string;
  confidence: number;
  reference: string;
}

export interface DayKpis {
  entries: number;
  compliant: number;
  compliancePct: number;
  openAlerts: number;
  pendingTriage: number;
  linkedStandards: number;
}

export interface Project {
  id: number;
  name: string;
  /** Contexto atual exibido sob o nome — ex: "Apto 1403 · Laje tipo 04" */
  context: string | null;
  sector: { code: string; name: string };
}

/** Payload agregado da visão "diário do dia". */
export interface DiaryDay {
  date: string;
  project: Project;
  kpis: DayKpis;
  entries: Entry[];
  alerts: Alert[];
  triage: TriageItem[];
}
