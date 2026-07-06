import type { WahaMessagePayload } from "../types/waha";

export type FlowStep =
  | "MAIN_MENU"
  | "ACTION_MENU"
  | "SELECT_EMPRESA"
  | "AWAITING_SERVICE_TYPE"
  | "AWAITING_PROCEDURE_NUMBER"
  | "AWAITING_PHOTO"
  | "AWAITING_DESCRIPTION"
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
  empresaNome: string;
  obraNome?: string | null;
  reportDate: string;
  generatedAt: Date;
  entradas: EntradaForReport[];
}

export interface ConversationStore {
  findUserByPhone(phoneDigits: string): Promise<UserRecord | null>;
  findEmpresasByUser(userId: number): Promise<EmpresaRecord[]>;
  findObrasAtivas(): Promise<ObraRecord[]>;
  getState(chatId: string): Promise<ConversationStateRecord | null>;
  saveState(input: SaveConversationStateInput): Promise<ConversationStateRecord>;
  clearState(chatId: string): Promise<void>;
  createEntrada(input: CreateEntradaInput): Promise<{ id: bigint }>;
  createTreinamento(input: CreateTreinamentoInput): Promise<{ entradaId: bigint; treinamentoId: number }>;
  addEntradaMedia(input: { entradaId: bigint; mediaUrl: string; mediaTipo?: string | null }): Promise<void>;
  updateEntradaDescription(entradaId: bigint, description: string): Promise<void>;
  findEntradasForReport(input: {
    empresaId: bigint;
    obraId?: number | null;
    tipo: string;
    dateStart: Date;
    dateEnd: Date;
  }): Promise<EntradaForReport[]>;
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
  download(url: string): Promise<Buffer>;
}

export interface ObjectStorage {
  uploadPrivateObject(input: { path: string; body: Buffer; contentType: string }): Promise<void>;
  downloadPrivateObject(path: string): Promise<Buffer>;
}

export interface PdfGenerator {
  generateReport(input: ReportInput): Promise<Buffer>;
}

export interface ConversationServiceDeps {
  store: ConversationStore;
  messaging: MessagingClient;
  mediaDownloader: MediaDownloader;
  objectStorage: ObjectStorage;
  pdfGenerator: PdfGenerator;
}

export interface FlowHandleInput {
  chatId: string;
  phoneE164: string;
  user: UserRecord;
  state: ConversationStateRecord;
  text: string;
  payload: WahaMessagePayload;
}

export interface FlowDefinition {
  key: string;
  resetToMenu(chatId: string, phoneE164: string): Promise<void>;
  start(input: FlowHandleInput): Promise<void>;
  handle(input: FlowHandleInput): Promise<void>;
}
