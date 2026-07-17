import type { IncomingMessage } from "../types/message";

export type FlowStep =
  | "MAIN_MENU"
  | "ACTION_MENU"
  | "SELECT_EMPRESA"
  | "AWAITING_SERVICE_TYPE"
  | "AWAITING_PROCEDURE_NUMBER"
  | "AWAITING_PHOTO"
  | "AWAITING_DESCRIPTION"
  | "AWAITING_POST_SAVE_CHOICE"
  | "AWAITING_INSPECT_DATE"
  | "SELECT_EMPRESA_FOR_REPORT"
  | "AWAITING_REPORT_DATE"
  | "SELECT_EMPRESA_FOR_TRAINING"
  | "AWAITING_TRAINING_TEMA"
  | "AWAITING_TRAINING_PARTICIPANTS"
  | "AWAITING_TRAINING_DATES"
  | "AWAITING_TRAINING_PHOTO"
  | "AWAITING_TRAINING_FILE";

export type FlowData = Record<string, unknown>;

export interface UserRecord {
  id: number;
  phoneE164: string;
  telegramUserId?: string | null;
  nome?: string | null;
}

export interface EmpresaRecord {
  id: bigint;
  nome?: string | null;
}

/** Obra (projects) disponível para vincular registros. */
export interface ObraRecord {
  id: number;
  nome: string;
  codigo: string;
}

export interface ConversationStateRecord {
  chatId: string;
  phoneE164: string;
  step: FlowStep;
  flowKey?: string | null;
  stepKey?: string | null;
  flowData?: FlowData | null;
  selectedTipo?: string | null;
  selectedEmpresaId?: bigint | null;
  selectedObraId?: number | null;
  selectedObraNome?: string | null;
  selectedTipoServico?: string | null;
  selectedNumeroProcedimento?: string | null;
  selectedTreinamentoTema?: string | null;
  selectedTreinamentoParticipantes?: string | null;
  selectedTreinamentoInicio?: Date | null;
  selectedTreinamentoFim?: Date | null;
  selectedTrainingPhotoCount?: number | null;
  pendingEntradaId?: bigint | null;
  /** Ultima atualizacao do estado, usada para expirar a sessao por inatividade. */
  updatedAt?: Date | null;
}

export interface SaveConversationStateInput extends ConversationStateRecord {}

export interface CreateEntradaInput {
  userId: number;
  empresaId: bigint;
  obraId?: number | null;
  tipo: string;
  tipoServico?: string | null;
  numeroProcedimento?: string | null;
  description: string;
}

export interface CreateTreinamentoInput {
  userId: number;
  empresaId: bigint;
  obraId?: number | null;
  tema: string;
  participantes: string;
  inicio: Date;
  fim: Date;
}

export interface EntradaForReport {
  id: bigint;
  description: string | null;
  createdAt: Date;
  tipo: string | null;
  tipoServico: string | null;
  numeroProcedimento: string | null;
  treinamentoTema?: string | null;
  treinamentoParticipantes?: string | null;
  treinamentoInicio?: Date | null;
  treinamentoFim?: Date | null;
  empresaNome: string | null;
  usuarioNome: string | null;
  mediaUrls: string[];
}

export interface ReportInput {
  categoria: string;
  empresaNome?: string | null;
  obraNome?: string | null;
  reportDate: string;
  generatedAt: Date;
  entradas: EntradaForReport[];
}

export interface ObraForReport {
  id: number;
  nome: string;
  /** Código da obra (ex: "130"), exibido no cabeçalho do diário. */
  codigo?: string | null;
  /** Nome da construtora dona da obra (Company.name), exibido no cabeçalho. */
  construtoraNome?: string | null;
  whatsappGroupId: string | null;
  whatsappAutoReportEnabled: boolean;
  status: string;
}

export interface ConversationStore {
  findUserByPhone(phoneDigits: string): Promise<UserRecord | null>;
  findUserByTelegramId(telegramUserId: string): Promise<UserRecord | null>;
  findEmpresasByUser(userId: number): Promise<EmpresaRecord[]>;
  findObrasAtivas(): Promise<ObraRecord[]>;
  getState(chatId: string): Promise<ConversationStateRecord | null>;
  saveState(input: SaveConversationStateInput): Promise<ConversationStateRecord>;
  clearState(chatId: string): Promise<void>;
  createEntrada(input: CreateEntradaInput): Promise<{ id: bigint }>;
  /**
   * Verifica de forma determinística se o texto (descrição/legenda) contém ao
   * menos um código de procedimento — um código cujo prefixo classifica como
   * STANDARD no setor da obra. Não exige que a norma exista cadastrada; serve
   * apenas para decidir se o usuário informou (ou não) o procedimento.
   */
  hasProcedureCode(input: { obraId?: number | null; text: string }): Promise<boolean>;
  createTreinamento(input: CreateTreinamentoInput): Promise<{ entradaId: bigint; treinamentoId: number }>;
  addEntradaMedia(input: { entradaId: bigint; mediaUrl: string; mediaTipo?: string | null }): Promise<void>;
  updateEntradaDescription(entradaId: bigint, description: string): Promise<void>;
  /** Grava o número do procedimento (campo dedicado) e reprocessa as menções. */
  updateEntradaProcedureNumber(entradaId: bigint, numeroProcedimento: string): Promise<void>;
  findEntradasForReport(input: {
    empresaId: bigint;
    obraId?: number | null;
    tipo: string;
    dateStart: Date;
    dateEnd: Date;
  }): Promise<EntradaForReport[]>;
  findEntradasForObraDay(input: { obraId: number; dateStart: Date; dateEnd: Date }): Promise<EntradaForReport[]>;
  findObraById(obraId: number): Promise<ObraForReport | null>;
  findObrasForAutoReport(): Promise<ObraForReport[]>;
  /**
   * Atribui (ou reusa) o número sequencial do diário de obra para um dia.
   * Idempotente por (projeto, data): a primeira chamada consome o próximo
   * número do projeto; chamadas seguintes para o mesmo dia devolvem o mesmo.
   */
  assignDailyReportNumber(input: { obraId: number; date: string }): Promise<number>;
}

export interface MessagingClient {
  sendText(chatId: string, text: string): Promise<void>;
  sendFile(
    chatId: string,
    file: { mimetype: string; filename: string; data: string },
    caption?: string
  ): Promise<void>;
}

export interface MediaDownloader {
  /**
   * Baixa a mídia a partir de uma referência opaca do canal.
   * WAHA: a URL. Telegram: o file_id.
   */
  download(ref: string): Promise<Buffer>;
}

export interface ObjectStorage {
  uploadPrivateObject(input: { path: string; body: Buffer; contentType: string }): Promise<void>;
  downloadPrivateObject(path: string): Promise<Buffer>;
}

/**
 * Entrada do "Diário de Obra" diário no formato do formulário manual
 * (F-06-03): cabeçalho com construtora/empreendimento, tabela de atividades
 * por empresa e grade de fotos numeradas.
 */
export interface DailyReportInput {
  obraNome: string;
  obraCodigo?: string | null;
  construtoraNome?: string | null;
  /** Data do diário em ISO (YYYY-MM-DD). */
  reportDate: string;
  generatedAt: Date;
  entradas: EntradaForReport[];
}

export interface PdfGenerator {
  generateReport(input: ReportInput): Promise<Buffer>;
  generateDailyReport(input: DailyReportInput): Promise<Buffer>;
}

/**
 * Gerador do "Diário do Dia" (mesmo usado pelo painel em /relatorios e pelo
 * job automático). O fluxo do WhatsApp (menu "Gerar diario de obra") delega
 * aqui para que todos os canais produzam o mesmo PDF.
 */
export interface DailyReportGenerator {
  generateForObraDay(input: {
    obraId: number;
    date: string;
  }): Promise<{ buffer: Buffer; totalEntradas: number; filename: string | null } | null>;
}

export interface ConversationServiceDeps {
  store: ConversationStore;
  messaging: MessagingClient;
  mediaDownloader: MediaDownloader;
  objectStorage: ObjectStorage;
  pdfGenerator: PdfGenerator;
  dailyReport: DailyReportGenerator;
}

export interface FlowHandleInput {
  chatId: string;
  phoneE164: string;
  user: UserRecord;
  state: ConversationStateRecord;
  text: string;
  payload: IncomingMessage;
}

export interface FlowDefinition {
  key: string;
  resetToMenu(chatId: string, phoneE164: string): Promise<void>;
  start(input: FlowHandleInput): Promise<void>;
  handle(input: FlowHandleInput): Promise<void>;
}
