import type { WahaMessagePayload, WahaWebhook } from "../types/waha";
import {
  extractPhoneFromWahaPayload,
  getWahaPhoneLookupCandidates,
  readNestedString
} from "../utils/phone";

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

const ENTRY_TIPOS = [
  "Inspecao de servico",
  "Abrir nao conformidade",
  "Recebimento de material",
  "Plano de manutencao",
  "Programa sol",
  "Treinamento"
] as const;

export type EntryTipo = (typeof ENTRY_TIPOS)[number];

const TIPO_SERVICOS = [
  "Alvenaria",
  "Hidráulica",
  "Elétrica",
  "Organização e Limpeza",
  "Segurança",
  "Concretagem",
  "Outros"
] as const;

export type TipoServico = (typeof TIPO_SERVICOS)[number];

const TRAINING_MEDIA_TYPES = {
  photo: "treinamento_foto",
  file: "treinamento_arquivo"
} as const;

type TrainingMediaType = (typeof TRAINING_MEDIA_TYPES)[keyof typeof TRAINING_MEDIA_TYPES];

export interface UserRecord {
  id: number;
  phoneE164: string;
  nome?: string | null;
}

export interface EmpresaRecord {
  id: bigint;
  nome?: string | null;
}

export interface ConversationStateRecord {
  chatId: string;
  phoneE164: string;
  step: FlowStep;
  selectedTipo?: string | null;
  selectedEmpresaId?: bigint | null;
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
  tipo: EntryTipo;
  tipoServico?: TipoServico | null;
  numeroProcedimento?: string | null;
  description: string;
}

export interface CreateTreinamentoInput {
  userId: number;
  empresaId: bigint;
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
  reportDate: string;
  generatedAt: Date;
  entradas: EntradaForReport[];
}

export interface ConversationStore {
  findUserByPhone(phoneDigits: string): Promise<UserRecord | null>;
  findEmpresasByUser(userId: number): Promise<EmpresaRecord[]>;
  getState(chatId: string): Promise<ConversationStateRecord | null>;
  saveState(input: SaveConversationStateInput): Promise<ConversationStateRecord>;
  clearState(chatId: string): Promise<void>;
  createEntrada(input: CreateEntradaInput): Promise<{ id: bigint }>;
  createTreinamento(input: CreateTreinamentoInput): Promise<{ entradaId: bigint; treinamentoId: number }>;
  addEntradaMedia(input: { entradaId: bigint; mediaUrl: string; mediaTipo?: string | null }): Promise<void>;
  updateEntradaDescription(entradaId: bigint, description: string): Promise<void>;
  findEntradasForReport(input: {
    empresaId: bigint;
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

const TIPO_OPTIONS: Record<string, EntryTipo> = {
  "1": "Inspecao de servico",
  "2": "Abrir nao conformidade",
  "3": "Recebimento de material",
  "4": "Plano de manutencao",
  "5": "Programa sol",
  "6": "Treinamento"
};

const ACTION_OPTIONS = {
  consulta: "1",
  incluir: "2"
};

const TIPO_SERVICO_OPTIONS: Record<string, TipoServico> = {
  "1": "Alvenaria",
  "2": "Hidráulica",
  "3": "Elétrica",
  "4": "Organização e Limpeza",
  "5": "Segurança",
  "6": "Concretagem",
  "7": "Outros"
};

const RESET_COMMANDS = new Set(["0", "menu", "cancelar"]);
const TRAINING_PHOTO_DONE_COMMANDS = new Set(["ok", "pronto", "concluir", "fim"]);

export class ConversationService {
  constructor(private readonly deps: ConversationServiceDeps) {}

  async handleWebhook(webhook: WahaWebhook): Promise<void> {
    if (!this.isSupportedWebhook(webhook)) {
      return;
    }

    const payload = webhook.payload;
    const chatId = payload.from ?? payload.chatId;
    if (!chatId) {
      return;
    }

    const wahaPhoneDigits = extractPhoneFromWahaPayload(payload);
    const phoneLookupCandidates = getWahaPhoneLookupCandidates(wahaPhoneDigits);
    const phoneDebugFields = this.wahaPhoneDebugFields(payload);
    this.logWahaDebug("WAHA webhook phone lookup started", {
      event: webhook.event,
      session: webhook.session,
      chatId,
      hasMedia: payload.hasMedia ?? false,
      source: payload.source ?? null,
      ...phoneDebugFields,
      wahaPhoneDigits,
      phoneLookupCandidates
    });

    const user = await this.findUserByWahaPhone(phoneLookupCandidates);
    if (!user) {
      console.warn("WAHA phone lookup did not match a registered user", {
        event: webhook.event,
        session: webhook.session,
        chatId,
        ...phoneDebugFields,
        wahaPhoneDigits,
        phoneLookupCandidates
      });
      await this.deps.messaging.sendText(
        chatId,
        "Numero nao cadastrado. Fale com o administrador para liberar o acesso."
      );
      return;
    }

    const phoneE164 = user.phoneE164;
    this.logWahaDebug("WAHA phone lookup matched registered user", {
      chatId,
      wahaPhoneDigits,
      phoneLookupCandidates,
      matchedPhoneE164: phoneE164,
      userId: user.id
    });

    const text = (payload.body ?? "").trim();
    if (this.isResetCommand(text)) {
      this.logWahaDebug("WAHA reset command received", {
        chatId,
        phoneE164,
        userId: user.id,
        command: text.toLowerCase()
      });
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const state = await this.deps.store.getState(chatId);
    this.logWahaDebug("WAHA conversation state loaded", {
      chatId,
      phoneE164,
      userId: user.id,
      stateStep: state?.step ?? null,
      hasMedia: payload.hasMedia ?? false,
      textLength: text.length
    });

    if (!state) {
      await this.deps.store.saveState({
        chatId,
        phoneE164,
        step: "MAIN_MENU",
        selectedTipo: null,
        selectedEmpresaId: null,
        selectedTipoServico: null,
        selectedNumeroProcedimento: null,
        selectedTreinamentoTema: null,
        selectedTreinamentoParticipantes: null,
        selectedTreinamentoInicio: null,
        selectedTreinamentoFim: null,
        selectedTrainingPhotoCount: null,
        pendingEntradaId: null
      });
      this.logWahaDebug("WAHA conversation state created", {
        chatId,
        phoneE164,
        userId: user.id,
        step: "MAIN_MENU"
      });
      await this.deps.messaging.sendText(chatId, this.mainMenuText());
      return;
    }

    switch (state.step) {
      case "MAIN_MENU":
        await this.handleMainMenu(chatId, phoneE164, user.id, text);
        return;
      case "ACTION_MENU":
        await this.handleActionMenu(chatId, phoneE164, user.id, state, text);
        return;
      case "SELECT_EMPRESA":
        await this.handleEmpresaSelection(chatId, phoneE164, user.id, state, text);
        return;
      case "AWAITING_SERVICE_TYPE":
        await this.handleServiceType(chatId, phoneE164, state, text);
        return;
      case "AWAITING_PROCEDURE_NUMBER":
        await this.handleProcedureNumber(chatId, phoneE164, user.id, state, text);
        return;
      case "AWAITING_PHOTO":
        await this.handlePhoto(chatId, phoneE164, user.id, state, payload);
        return;
      case "AWAITING_DESCRIPTION":
        await this.handleDescription(chatId, state, text);
        return;
      case "AWAITING_INSPECT_DATE":
        await this.resetToMenu(chatId, phoneE164);
        return;
      case "SELECT_EMPRESA_FOR_REPORT":
        await this.handleEmpresaSelectionForReport(chatId, phoneE164, user.id, state, text);
        return;
      case "AWAITING_REPORT_DATE":
        await this.handleReportDate(chatId, phoneE164, state, text);
        return;
      case "SELECT_EMPRESA_FOR_TRAINING":
        await this.handleEmpresaSelectionForTraining(chatId, phoneE164, user.id, state, text);
        return;
      case "AWAITING_TRAINING_TEMA":
        await this.handleTrainingTema(chatId, phoneE164, state, text);
        return;
      case "AWAITING_TRAINING_PARTICIPANTS":
        await this.handleTrainingParticipants(chatId, phoneE164, state, text);
        return;
      case "AWAITING_TRAINING_DATES":
        await this.handleTrainingDates(chatId, phoneE164, user.id, state, text);
        return;
      case "AWAITING_TRAINING_PHOTO":
        await this.handleTrainingPhoto(chatId, phoneE164, user.id, state, payload);
        return;
      case "AWAITING_TRAINING_FILE":
        await this.handleTrainingFile(chatId, phoneE164, user.id, state, payload);
        return;
    }
  }

  private async findUserByWahaPhone(phoneLookupCandidates: string[]): Promise<UserRecord | null> {
    for (const candidate of phoneLookupCandidates) {
      const user = await this.deps.store.findUserByPhone(candidate);
      if (user) {
        return user;
      }
    }

    return null;
  }

  private wahaPhoneDebugFields(payload: WahaMessagePayload): Record<string, string | null> {
    return {
      payloadFrom: payload.from ?? null,
      payloadChatId: payload.chatId ?? null,
      sender: readNestedString(payload, ["_data", "Info", "Sender"]) ?? readNestedString(payload, ["_data", "Sender"]) ?? null,
      senderAlt:
        readNestedString(payload, ["_data", "Info", "SenderAlt"]) ??
        readNestedString(payload, ["_data", "SenderAlt"]) ??
        null
    };
  }

  private logWahaDebug(message: string, details: Record<string, unknown>): void {
    if (isWahaDebugLoggingEnabled()) {
      console.info(message, details);
    }
  }

  private isSupportedWebhook(webhook: WahaWebhook): webhook is WahaWebhook & { payload: WahaMessagePayload } {
    if (webhook.event !== "message" && webhook.event !== "message.any") {
      return false;
    }

    if (!webhook.payload) {
      return false;
    }

    if (webhook.payload.fromMe || webhook.payload.source === "api") {
      return false;
    }

    return true;
  }

  private async handleMainMenu(chatId: string, phoneE164: string, userId: number, text: string): Promise<void> {
    const tipo = TIPO_OPTIONS[text];
    if (!tipo) {
      await this.deps.messaging.sendText(chatId, `Opcao invalida.\n\n${this.mainMenuText()}`);
      return;
    }

    if (tipo === "Treinamento") {
      await this.resolveEmpresaForTraining(chatId, phoneE164, userId);
      return;
    }

    await this.deps.store.saveState({
      chatId,
      phoneE164,
      step: "ACTION_MENU",
      selectedTipo: tipo,
      selectedEmpresaId: null,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      pendingEntradaId: null
    });

    await this.deps.messaging.sendText(chatId, this.actionMenuText(tipo));
  }

  private async handleActionMenu(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    const tipo = this.requireSelectedTipo(state);
    if (!tipo) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    if (text === ACTION_OPTIONS.consulta) {
      await this.handleConsulta(chatId, phoneE164, userId, state);
      return;
    }

    if (text === ACTION_OPTIONS.incluir) {
      await this.resolveEmpresaForAdd(chatId, phoneE164, userId, tipo);
      return;
    }

    await this.deps.messaging.sendText(chatId, `Opcao invalida.\n\n${this.actionMenuText(tipo)}`);
  }

  private async resolveEmpresaForAdd(
    chatId: string,
    phoneE164: string,
    userId: number,
    tipo: EntryTipo
  ): Promise<void> {
    const empresas = await this.deps.store.findEmpresasByUser(userId);
    if (empresas.length === 0) {
      await this.deps.store.clearState(chatId);
      await this.deps.messaging.sendText(
        chatId,
        "Nenhuma empresa vinculada ao seu usuario. Fale com o administrador."
      );
      return;
    }

    if (empresas.length === 1) {
      await this.deps.store.saveState({
        chatId,
        phoneE164,
        step: "AWAITING_SERVICE_TYPE",
        selectedTipo: tipo,
        selectedEmpresaId: empresas[0].id,
        selectedTipoServico: null,
        selectedNumeroProcedimento: null,
        pendingEntradaId: null
      });
      await this.deps.messaging.sendText(chatId, this.tipoServicoMenuText(tipo));
      return;
    }

    await this.deps.store.saveState({
      chatId,
      phoneE164,
      step: "SELECT_EMPRESA",
      selectedTipo: tipo,
      selectedEmpresaId: null,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      pendingEntradaId: null
    });
    await this.deps.messaging.sendText(chatId, this.empresaMenuText(empresas));
  }

  private async handleEmpresaSelection(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    const tipo = this.requireSelectedTipo(state);
    if (!tipo) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const empresas = await this.deps.store.findEmpresasByUser(userId);
    const selectedIndex = Number(text) - 1;
    const empresa = Number.isInteger(selectedIndex) ? empresas[selectedIndex] : undefined;
    if (!empresa) {
      await this.deps.messaging.sendText(chatId, `Opcao invalida.\n\n${this.empresaMenuText(empresas)}`);
      return;
    }

    await this.deps.store.saveState({
      chatId,
      phoneE164,
      step: "AWAITING_SERVICE_TYPE",
      selectedTipo: tipo,
      selectedEmpresaId: empresa.id,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      pendingEntradaId: null
    });
    await this.deps.messaging.sendText(chatId, this.tipoServicoMenuText(tipo));
  }

  private async resolveEmpresaForTraining(chatId: string, phoneE164: string, userId: number): Promise<void> {
    const empresas = await this.deps.store.findEmpresasByUser(userId);
    if (empresas.length === 0) {
      await this.deps.store.clearState(chatId);
      await this.deps.messaging.sendText(
        chatId,
        "Nenhuma empresa vinculada ao seu usuario. Fale com o administrador."
      );
      return;
    }

    if (empresas.length === 1) {
      await this.deps.store.saveState({
        chatId,
        phoneE164,
        step: "AWAITING_TRAINING_TEMA",
        selectedTipo: "Treinamento",
        selectedEmpresaId: empresas[0].id,
        selectedTipoServico: null,
        selectedNumeroProcedimento: null,
        selectedTreinamentoTema: null,
        selectedTreinamentoParticipantes: null,
        selectedTreinamentoInicio: null,
        selectedTreinamentoFim: null,
        selectedTrainingPhotoCount: null,
        pendingEntradaId: null
      });
      await this.deps.messaging.sendText(chatId, this.trainingTemaPromptText());
      return;
    }

    await this.deps.store.saveState({
      chatId,
      phoneE164,
      step: "SELECT_EMPRESA_FOR_TRAINING",
      selectedTipo: "Treinamento",
      selectedEmpresaId: null,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      selectedTreinamentoTema: null,
      selectedTreinamentoParticipantes: null,
      selectedTreinamentoInicio: null,
      selectedTreinamentoFim: null,
      selectedTrainingPhotoCount: null,
      pendingEntradaId: null
    });
    await this.deps.messaging.sendText(chatId, this.empresaMenuText(empresas));
  }

  private async handleEmpresaSelectionForTraining(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    const empresas = await this.deps.store.findEmpresasByUser(userId);
    const selectedIndex = Number(text) - 1;
    const empresa = Number.isInteger(selectedIndex) ? empresas[selectedIndex] : undefined;
    if (!empresa) {
      await this.deps.messaging.sendText(chatId, `Opcao invalida.\n\n${this.empresaMenuText(empresas)}`);
      return;
    }

    await this.deps.store.saveState({
      chatId,
      phoneE164,
      step: "AWAITING_TRAINING_TEMA",
      selectedTipo: "Treinamento",
      selectedEmpresaId: empresa.id,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      selectedTreinamentoTema: null,
      selectedTreinamentoParticipantes: null,
      selectedTreinamentoInicio: null,
      selectedTreinamentoFim: null,
      selectedTrainingPhotoCount: null,
      pendingEntradaId: null
    });
    await this.deps.messaging.sendText(chatId, this.trainingTemaPromptText());
  }

  private async handleTrainingTema(
    chatId: string,
    phoneE164: string,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    if (state.selectedTipo !== "Treinamento" || !state.selectedEmpresaId) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const tema = text.trim();
    if (!tema) {
      await this.deps.messaging.sendText(chatId, this.trainingTemaPromptText());
      return;
    }

    await this.deps.store.saveState({
      ...state,
      chatId,
      phoneE164,
      step: "AWAITING_TRAINING_PARTICIPANTS",
      selectedTreinamentoTema: tema
    });
    await this.deps.messaging.sendText(chatId, this.trainingParticipantsPromptText());
  }

  private async handleTrainingParticipants(
    chatId: string,
    phoneE164: string,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    if (state.selectedTipo !== "Treinamento" || !state.selectedEmpresaId || !state.selectedTreinamentoTema) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const participantes = text.trim();
    if (!participantes) {
      await this.deps.messaging.sendText(chatId, this.trainingParticipantsPromptText());
      return;
    }

    await this.deps.store.saveState({
      ...state,
      chatId,
      phoneE164,
      step: "AWAITING_TRAINING_DATES",
      selectedTreinamentoParticipantes: participantes
    });
    await this.deps.messaging.sendText(chatId, this.trainingDatesPromptText());
  }

  private async handleTrainingDates(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    if (
      state.selectedTipo !== "Treinamento" ||
      !state.selectedEmpresaId ||
      !state.selectedTreinamentoTema ||
      !state.selectedTreinamentoParticipantes
    ) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const dateRange = parseTrainingDateRange(text);
    if (!dateRange) {
      await this.deps.messaging.sendText(chatId, `Data/hora invalida.\n\n${this.trainingDatesPromptText()}`);
      return;
    }

    const treinamento = await this.deps.store.createTreinamento({
      userId,
      empresaId: state.selectedEmpresaId,
      tema: state.selectedTreinamentoTema,
      participantes: state.selectedTreinamentoParticipantes,
      inicio: dateRange.inicio,
      fim: dateRange.fim
    });

    await this.deps.store.saveState({
      ...state,
      chatId,
      phoneE164,
      step: "AWAITING_TRAINING_PHOTO",
      selectedTreinamentoInicio: dateRange.inicio,
      selectedTreinamentoFim: dateRange.fim,
      selectedTrainingPhotoCount: 0,
      pendingEntradaId: treinamento.entradaId
    });
    await this.deps.messaging.sendText(chatId, this.trainingPhotoPromptText());
  }

  private async handleTrainingPhoto(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    payload: WahaMessagePayload
  ): Promise<void> {
    if (!state.selectedEmpresaId || !state.pendingEntradaId) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const text = (payload.body ?? "").trim().toLowerCase();
    const photoCount = state.selectedTrainingPhotoCount ?? 0;
    if (TRAINING_PHOTO_DONE_COMMANDS.has(text)) {
      if (photoCount === 0) {
        await this.deps.messaging.sendText(chatId, "Envie pelo menos uma foto do treinamento para continuar.");
        return;
      }

      await this.deps.store.saveState({
        ...state,
        chatId,
        phoneE164,
        step: "AWAITING_TRAINING_FILE"
      });
      await this.deps.messaging.sendText(chatId, this.trainingFilePromptText());
      return;
    }

    const uploaded = await this.handleTrainingMediaUpload({
      chatId,
      userId,
      state,
      payload,
      mediaTipo: TRAINING_MEDIA_TYPES.photo,
      allowedKinds: "image",
      missingMessage: "Envie uma foto do treinamento para continuar.",
      invalidMessage: "O arquivo precisa ser uma imagem. Envie uma foto do treinamento."
    });
    if (!uploaded) {
      return;
    }

    await this.deps.store.saveState({
      ...state,
      chatId,
      phoneE164,
      selectedTrainingPhotoCount: photoCount + 1
    });
    await this.deps.messaging.sendText(chatId, "Foto recebida. Envie outra foto ou digite OK para continuar.");
  }

  private async handleTrainingFile(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    payload: WahaMessagePayload
  ): Promise<void> {
    if (!state.selectedEmpresaId || !state.pendingEntradaId) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const uploaded = await this.handleTrainingMediaUpload({
      chatId,
      userId,
      state,
      payload,
      mediaTipo: TRAINING_MEDIA_TYPES.file,
      allowedKinds: "image-or-pdf",
      missingMessage: "Envie o arquivo do treinamento em PDF ou foto.",
      invalidMessage: "O arquivo precisa ser PDF ou imagem. Envie novamente."
    });
    if (!uploaded) {
      return;
    }

    await this.deps.store.clearState(chatId);
    await this.deps.messaging.sendText(chatId, "Treinamento salvo com sucesso.");
  }

  private async handleTrainingMediaUpload(input: {
    chatId: string;
    userId: number;
    state: ConversationStateRecord;
    payload: WahaMessagePayload;
    mediaTipo: TrainingMediaType;
    allowedKinds: "image" | "image-or-pdf";
    missingMessage: string;
    invalidMessage: string;
  }): Promise<boolean> {
    const media = input.payload.media;
    if (!input.payload.hasMedia || !media?.url) {
      await this.deps.messaging.sendText(input.chatId, input.missingMessage);
      return false;
    }

    const contentType = media.mimetype ?? "application/octet-stream";
    const isImage = contentType.startsWith("image/");
    const isPdf = contentType === "application/pdf";
    if (!isImage && (input.allowedKinds !== "image-or-pdf" || !isPdf)) {
      await this.deps.messaging.sendText(input.chatId, input.invalidMessage);
      return false;
    }

    try {
      const body = await this.deps.mediaDownloader.download(media.url);
      const objectPath = buildStoragePath({
        empresaId: input.state.selectedEmpresaId!,
        userId: input.userId,
        messageId: input.payload.id,
        filename: media.filename,
        contentType
      });

      await this.deps.objectStorage.uploadPrivateObject({
        path: objectPath,
        body,
        contentType
      });

      await this.deps.store.addEntradaMedia({
        entradaId: input.state.pendingEntradaId!,
        mediaUrl: objectPath,
        mediaTipo: input.mediaTipo
      });

      return true;
    } catch (error) {
      console.error("Failed to process WhatsApp training media", error);
      await this.deps.messaging.sendText(
        input.chatId,
        "Nao consegui processar o arquivo. Tente enviar novamente em alguns instantes."
      );
      return false;
    }
  }

  private async handleServiceType(
    chatId: string,
    phoneE164: string,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    const tipo = this.requireSelectedTipo(state);
    if (!tipo || !state.selectedEmpresaId) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const tipoServico = TIPO_SERVICO_OPTIONS[text];
    if (!tipoServico) {
      await this.deps.messaging.sendText(chatId, `Opcao invalida.\n\n${this.tipoServicoMenuText(tipo)}`);
      return;
    }

    await this.deps.store.saveState({
      chatId,
      phoneE164,
      step: "AWAITING_PROCEDURE_NUMBER",
      selectedTipo: tipo,
      selectedEmpresaId: state.selectedEmpresaId,
      selectedTipoServico: tipoServico,
      selectedNumeroProcedimento: null,
      pendingEntradaId: null
    });

    await this.deps.messaging.sendText(chatId, this.numeroProcedimentoPromptText());
  }

  private async handleProcedureNumber(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    const tipo = this.requireSelectedTipo(state);
    const tipoServico = this.requireSelectedTipoServico(state);
    if (!tipo || !state.selectedEmpresaId || !tipoServico) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const numeroProcedimento = text.trim();
    if (!numeroProcedimento) {
      await this.deps.messaging.sendText(chatId, this.numeroProcedimentoPromptText());
      return;
    }

    const empresa = await this.findSelectedEmpresaForUser(userId, state.selectedEmpresaId);
    await this.deps.store.saveState({
      chatId,
      phoneE164,
      step: "AWAITING_PHOTO",
      selectedTipo: tipo,
      selectedEmpresaId: state.selectedEmpresaId,
      selectedTipoServico: tipoServico,
      selectedNumeroProcedimento: numeroProcedimento,
      pendingEntradaId: null
    });

    await this.deps.messaging.sendText(
      chatId,
      this.photoPromptText(tipo, empresa, tipoServico, numeroProcedimento)
    );
  }

  private async handlePhoto(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    payload: WahaMessagePayload
  ): Promise<void> {
    const tipo = this.requireSelectedTipo(state);
    const tipoServico = this.requireSelectedTipoServico(state);
    const numeroProcedimento = state.selectedNumeroProcedimento?.trim();
    if (!tipo || !state.selectedEmpresaId || !tipoServico || !numeroProcedimento) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const media = payload.media;
    if (!payload.hasMedia || !media?.url) {
      await this.deps.messaging.sendText(chatId, "Envie uma foto para continuar.");
      return;
    }

    const contentType = media.mimetype ?? "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      await this.deps.messaging.sendText(chatId, "O arquivo precisa ser uma imagem. Envie uma foto para continuar.");
      return;
    }

    try {
      const body = await this.deps.mediaDownloader.download(media.url);
      const objectPath = buildStoragePath({
        empresaId: state.selectedEmpresaId,
        userId,
        messageId: payload.id,
        filename: media.filename,
        contentType
      });

      await this.deps.objectStorage.uploadPrivateObject({
        path: objectPath,
        body,
        contentType
      });

      const entrada = await this.deps.store.createEntrada({
        userId,
        empresaId: state.selectedEmpresaId,
        tipo,
        tipoServico,
        numeroProcedimento,
        description: ""
      });

      await this.deps.store.addEntradaMedia({
        entradaId: entrada.id,
        mediaUrl: objectPath
      });

      await this.deps.store.saveState({
        chatId,
        phoneE164,
        step: "AWAITING_DESCRIPTION",
        selectedTipo: tipo,
        selectedEmpresaId: state.selectedEmpresaId,
        selectedTipoServico: tipoServico,
        selectedNumeroProcedimento: numeroProcedimento,
        pendingEntradaId: entrada.id
      });

      await this.deps.messaging.sendText(chatId, "Foto recebida. Agora envie a descricao.");
    } catch (error) {
      console.error("Failed to process WhatsApp photo", error);
      await this.deps.messaging.sendText(
        chatId,
        "Nao consegui processar a foto. Tente enviar novamente em alguns instantes."
      );
    }
  }

  private async handleDescription(
    chatId: string,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    if (!state.pendingEntradaId) {
      await this.deps.store.clearState(chatId);
      await this.deps.messaging.sendText(chatId, this.mainMenuText());
      return;
    }

    if (!text) {
      await this.deps.messaging.sendText(chatId, "Envie uma descricao em texto para concluir.");
      return;
    }

    await this.deps.store.updateEntradaDescription(state.pendingEntradaId, text);
    await this.deps.store.clearState(chatId);
    await this.deps.messaging.sendText(chatId, "Registro salvo com sucesso.");
  }

  private async handleConsulta(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord
  ): Promise<void> {
    const tipo = this.requireSelectedTipo(state);
    if (!tipo) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const empresas = await this.deps.store.findEmpresasByUser(userId);
    if (empresas.length === 0) {
      await this.deps.store.clearState(chatId);
      await this.deps.messaging.sendText(
        chatId,
        "Nenhuma empresa vinculada ao seu usuario. Fale com o administrador."
      );
      return;
    }

    if (empresas.length === 1) {
      await this.deps.store.saveState({
        chatId,
        phoneE164,
        step: "AWAITING_REPORT_DATE",
        selectedTipo: tipo,
        selectedEmpresaId: empresas[0].id,
        pendingEntradaId: null
      });
      await this.deps.messaging.sendText(chatId, "Informe a data do relatorio no formato DD/MM/AAAA.");
      return;
    }

    await this.deps.store.saveState({
      chatId,
      phoneE164,
      step: "SELECT_EMPRESA_FOR_REPORT",
      selectedTipo: tipo,
      selectedEmpresaId: null,
      pendingEntradaId: null
    });
    await this.deps.messaging.sendText(chatId, this.empresaMenuText(empresas));
  }

  private async handleEmpresaSelectionForReport(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    const tipo = this.requireSelectedTipo(state);
    if (!tipo) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const empresas = await this.deps.store.findEmpresasByUser(userId);
    const selectedIndex = Number(text) - 1;
    const empresa = Number.isInteger(selectedIndex) ? empresas[selectedIndex] : undefined;
    if (!empresa) {
      await this.deps.messaging.sendText(chatId, `Opcao invalida.\n\n${this.empresaMenuText(empresas)}`);
      return;
    }

    await this.deps.store.saveState({
      chatId,
      phoneE164,
      step: "AWAITING_REPORT_DATE",
      selectedTipo: tipo,
      selectedEmpresaId: empresa.id,
      pendingEntradaId: null
    });
    await this.deps.messaging.sendText(chatId, "Informe a data do relatorio no formato DD/MM/AAAA.");
  }

  private async handleReportDate(
    chatId: string,
    phoneE164: string,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    const tipo = this.requireSelectedTipo(state);
    if (!tipo || !state.selectedEmpresaId) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const dateRange = parseReportDate(text);
    if (!dateRange) {
      await this.deps.messaging.sendText(chatId, "Data invalida. Informe a data no formato DD/MM/AAAA.");
      return;
    }

    await this.deps.messaging.sendText(chatId, "Gerando relatorio, aguarde...");

    const entradas = await this.deps.store.findEntradasForReport({
      empresaId: state.selectedEmpresaId,
      tipo,
      dateStart: dateRange.start,
      dateEnd: dateRange.end
    });

    if (entradas.length === 0) {
      await this.deps.store.clearState(chatId);
      await this.deps.messaging.sendText(
        chatId,
        `Nenhum registro encontrado para ${text}.\n\n${this.mainMenuText()}`
      );
      return;
    }

    const empresaNome = entradas[0].empresaNome ?? `Empresa ${state.selectedEmpresaId.toString()}`;
    const pdfBuffer = await this.deps.pdfGenerator.generateReport({
      categoria: tipo,
      empresaNome,
      reportDate: text,
      generatedAt: new Date(),
      entradas
    });

    const filename = `relatorio-${tipo.replace(/\s+/g, "-").toLowerCase()}-${text.replace(/\//g, "-")}.pdf`;
    await this.deps.messaging.sendFile(chatId, {
      mimetype: "application/pdf",
      filename,
      data: pdfBuffer.toString("base64")
    });

    await this.deps.store.clearState(chatId);
    await this.deps.messaging.sendText(chatId, this.mainMenuText());
  }

  private async resetToMenu(chatId: string, phoneE164: string): Promise<void> {
    await this.deps.store.saveState({
      chatId,
      phoneE164,
      step: "MAIN_MENU",
      selectedTipo: null,
      selectedEmpresaId: null,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      selectedTreinamentoTema: null,
      selectedTreinamentoParticipantes: null,
      selectedTreinamentoInicio: null,
      selectedTreinamentoFim: null,
      selectedTrainingPhotoCount: null,
      pendingEntradaId: null
    });
    await this.deps.messaging.sendText(chatId, this.mainMenuText());
  }

  private isResetCommand(text: string): boolean {
    return RESET_COMMANDS.has(text.toLowerCase());
  }

  private async findSelectedEmpresaForUser(userId: number, empresaId: bigint): Promise<EmpresaRecord> {
    const empresas = await this.deps.store.findEmpresasByUser(userId);
    return empresas.find((empresa) => empresa.id === empresaId) ?? { id: empresaId, nome: null };
  }

  private requireSelectedTipo(state: ConversationStateRecord): EntryTipo | null {
    if (isEntryTipo(state.selectedTipo)) {
      return state.selectedTipo;
    }

    return null;
  }

  private requireSelectedTipoServico(state: ConversationStateRecord): TipoServico | null {
    if (isTipoServico(state.selectedTipoServico)) {
      return state.selectedTipoServico;
    }

    return null;
  }

  private mainMenuText(): string {
    const options = ENTRY_TIPOS.map((tipo, index) => `${index + 1}) ${tipo}`).join("\n");
    return `O que voce quer acessar?\n${options}\n\nDigite 0 para voltar ao menu.`;
  }

  private actionMenuText(tipo: EntryTipo): string {
    return `${tipo}\n1) Consulta\n2) Incluir\n\nDigite 0 para voltar ao menu.`;
  }

  private empresaMenuText(empresas: EmpresaRecord[]): string {
    const options = empresas
      .map((empresa, index) => `${index + 1}) ${empresa.nome ?? `Empresa ${empresa.id.toString()}`}`)
      .join("\n");

    return `Escolha a empresa:\n${options}\n\nDigite 0 para voltar ao menu.`;
  }

  private tipoServicoMenuText(tipo: EntryTipo): string {
    const options = TIPO_SERVICOS.map((tipoServico, index) => `${index + 1}) ${tipoServico}`).join("\n");
    return `${tipo}\nEscolha o tipo de serviço:\n${options}\n\nDigite 0 para voltar ao menu.`;
  }

  private numeroProcedimentoPromptText(): string {
    return "Informe o número do procedimento utilizado.";
  }

  private photoPromptText(
    tipo: EntryTipo,
    empresa: EmpresaRecord,
    tipoServico: TipoServico,
    numeroProcedimento: string
  ): string {
    const empresaNome = empresa.nome ?? `Empresa ${empresa.id.toString()}`;
    return `${tipo} - ${empresaNome}\nTipo de serviço: ${tipoServico}\nProcedimento: ${numeroProcedimento}\nEnvie uma foto para incluir no registro.`;
  }

  private trainingTemaPromptText(): string {
    return "Informe o tema do treinamento.";
  }

  private trainingParticipantsPromptText(): string {
    return "Informe os nomes e CPFs dos participantes.";
  }

  private trainingDatesPromptText(): string {
    return "Informe data e hora de inicio e fim no formato DD/MM/AAAA HH:mm - DD/MM/AAAA HH:mm.";
  }

  private trainingPhotoPromptText(): string {
    return "Envie as fotos do treinamento. Quando terminar, digite OK.";
  }

  private trainingFilePromptText(): string {
    return "Envie o arquivo do treinamento em PDF ou foto.";
  }
}

function isWahaDebugLoggingEnabled(): boolean {
  const value = process.env.WAHA_DEBUG_LOGS?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function isEntryTipo(value: string | null | undefined): value is EntryTipo {
  return typeof value === "string" && (ENTRY_TIPOS as readonly string[]).includes(value);
}

function isTipoServico(value: string | null | undefined): value is TipoServico {
  return typeof value === "string" && (TIPO_SERVICOS as readonly string[]).includes(value);
}

function parseReportDate(text: string): { start: Date; end: Date } | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) {
    return null;
  }

  // Sao Paulo is UTC-3 (BRT; Brazil abolished DST in 2019)
  // Midnight Sao Paulo = 03:00 UTC
  const startUtc = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));

  if (
    startUtc.getUTCFullYear() !== year ||
    startUtc.getUTCMonth() !== month - 1 ||
    startUtc.getUTCDate() !== day
  ) {
    return null;
  }

  const endUtc = new Date(Date.UTC(year, month - 1, day + 1, 3, 0, 0, 0));

  return { start: startUtc, end: endUtc };
}

function parseTrainingDateRange(text: string): { inicio: Date; fim: Date } | null {
  const matches = [...text.matchAll(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/g)];
  if (matches.length !== 2) {
    return null;
  }

  const inicio = parseSaoPauloDateTime(matches[0]);
  const fim = parseSaoPauloDateTime(matches[1]);
  if (!inicio || !fim || fim.getTime() <= inicio.getTime()) {
    return null;
  }

  return { inicio, fim };
}

function parseSaoPauloDateTime(match: RegExpMatchArray): Date | null {
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);

  if (
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    year < 2000 ||
    year > 2100 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const localCalendar = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
  if (
    localCalendar.getUTCFullYear() !== year ||
    localCalendar.getUTCMonth() !== month - 1 ||
    localCalendar.getUTCDate() !== day ||
    localCalendar.getUTCHours() !== hour ||
    localCalendar.getUTCMinutes() !== minute
  ) {
    return null;
  }

  // Sao Paulo is UTC-3 (BRT; Brazil abolished DST in 2019).
  return new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0, 0));
}

function buildStoragePath(input: {
  empresaId: bigint;
  userId: number;
  messageId?: string;
  filename?: string | null;
  contentType: string;
}): string {
  const date = new Date().toISOString().slice(0, 10);
  const extension = extensionFrom(input.filename, input.contentType);
  const messageId = input.messageId ?? `${Date.now()}`;
  const safeMessageId = messageId.replace(/[^a-zA-Z0-9_.-]/g, "_");

  return `entradas/${input.empresaId.toString()}/${input.userId}/${date}/${safeMessageId}.${extension}`;
}

function extensionFrom(filename: string | null | undefined, contentType: string): string {
  const filenameExtension = filename?.split(".").pop();
  if (filenameExtension && /^[a-zA-Z0-9]+$/.test(filenameExtension)) {
    return filenameExtension.toLowerCase();
  }

  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    default:
      return "bin";
  }
}
