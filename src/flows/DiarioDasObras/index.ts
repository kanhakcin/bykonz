import type { WahaMessagePayload } from "../../types/waha";
import type {
  ConversationServiceDeps,
  ConversationStateRecord,
  EmpresaRecord,
  FlowData,
  FlowDefinition,
  FlowHandleInput,
  ObraRecord,
  SaveConversationStateInput
} from "../types";
import {
  isTipoServico,
  numeroProcedimentoPromptText,
  photoPromptText,
  tipoServicoMenuText,
  TIPO_SERVICO_OPTIONS
} from "./categoriaEntrada";
import { DIARIO_OBRA_REPORT_OPTION, DIARIO_OBRA_REPORT_TIPO } from "./gerarDiarioObra";
import { usesIncludeOnlyActionMenu } from "./inspecaoServico";
import {
  ACTION_OPTIONS,
  actionMenuText,
  INCLUDE_ONLY_ACTION_OPTIONS,
  isEntryTipo,
  mainMenuText,
  postSaveMenuText,
  POST_SAVE_OPTIONS,
  TIPO_OPTIONS
} from "./menu";
import {
  isObraFlowStepKey,
  isTrocarObraCommand,
  noObrasText,
  obraMenuText,
  obraSelecionadaText,
  OBRA_FLOW_STEPS,
  withObraHeader
} from "./obra";
import {
  isMaterialFlowStepKey,
  MATERIAL_FLOW_DATA_KEYS,
  MATERIAL_FLOW_STEPS,
  MATERIAL_MEDIA_TYPES,
  MATERIAL_TIPO,
  materialNotaPhotoPromptText,
  materialOsPromptText,
  materialPhotoPromptText,
  materialQualityPromptText,
  materialQuantityPromptText,
  parseMaterialAnswer,
  type MaterialAnswer
} from "./recebimentoMaterial";
import {
  TRAINING_MEDIA_TYPES,
  TRAINING_PHOTO_DONE_COMMANDS,
  type TrainingMediaType,
  trainingDatesPromptText,
  trainingFilePromptText,
  trainingParticipantsPromptText,
  trainingPhotoPromptText,
  trainingTemaPromptText
} from "./treinamento";
import { DIARIO_DAS_OBRAS_FLOW_KEY, type EntryTipo } from "./types";

const NENHUMA_EMPRESA_TEXT = "⚠️ Voce ainda nao tem empresa vinculada. Fale com o administrador.";

export class DiarioDasObrasFlow implements FlowDefinition {
  readonly key = DIARIO_DAS_OBRAS_FLOW_KEY;

  constructor(private readonly deps: ConversationServiceDeps) {}

  /**
   * Reinicia para o menu principal preservando a obra ativa: trocar de acao
   * nao deve fazer o usuario escolher a obra de novo no mesmo dia.
   */
  async resetToMenu(chatId: string, phoneE164: string): Promise<void> {
    const existing = await this.deps.store.getState(chatId);
    const state = existing ? hydrateDiarioState(existing) : null;

    if (state?.selectedObraId && state.selectedObraNome) {
      await this.goToMainMenu(chatId, phoneE164, state.selectedObraId, state.selectedObraNome);
      return;
    }

    await this.resolveObraThenStart(chatId, phoneE164);
  }

  async start(input: FlowHandleInput): Promise<void> {
    await this.resolveObraThenStart(input.chatId, input.phoneE164);
  }

  async handle(input: FlowHandleInput): Promise<void> {
    const state = hydrateDiarioState(input.state);

    // "trocar obra" funciona a qualquer momento, exceto durante a propria selecao de obra.
    if (isTrocarObraCommand(input.text) && !isObraFlowStepKey(state.stepKey)) {
      await this.resolveObraForSwitch(input.chatId, input.phoneE164);
      return;
    }

    switch (state.stepKey ?? state.step) {
      case OBRA_FLOW_STEPS.selectObra:
        await this.handleObraSelection(input.chatId, input.phoneE164, input.text);
        return;
      case "MAIN_MENU":
        await this.handleMainMenu(input.chatId, input.phoneE164, input.user.id, state, input.text);
        return;
      case "ACTION_MENU":
        await this.handleActionMenu(input.chatId, input.phoneE164, input.user.id, state, input.text);
        return;
      case "SELECT_EMPRESA":
        await this.handleEmpresaSelection(input.chatId, input.phoneE164, input.user.id, state, input.text);
        return;
      case "AWAITING_SERVICE_TYPE":
        await this.handleServiceType(input.chatId, input.phoneE164, state, input.text);
        return;
      case "AWAITING_PROCEDURE_NUMBER":
        await this.handleProcedureNumber(input.chatId, input.phoneE164, input.user.id, state, input.text);
        return;
      case "AWAITING_PHOTO":
        await this.handlePhoto(input.chatId, input.phoneE164, input.user.id, state, input.payload);
        return;
      case "AWAITING_DESCRIPTION":
        await this.handleDescription(input.chatId, state, input.text);
        return;
      case "AWAITING_POST_SAVE_CHOICE":
        await this.handlePostSaveChoice(input.chatId, input.phoneE164, input.user.id, state, input.text);
        return;
      case MATERIAL_FLOW_STEPS.awaitingOs:
        await this.handleMaterialOs(input.chatId, input.phoneE164, state, input.text);
        return;
      case MATERIAL_FLOW_STEPS.awaitingNotaPhoto:
        await this.handleMaterialNotaPhoto(input.chatId, input.phoneE164, input.user.id, state, input.payload);
        return;
      case MATERIAL_FLOW_STEPS.awaitingMaterialPhoto:
        await this.handleMaterialPhoto(input.chatId, input.phoneE164, input.user.id, state, input.payload);
        return;
      case MATERIAL_FLOW_STEPS.awaitingQuantity:
        await this.handleMaterialQuantity(input.chatId, input.phoneE164, state, input.text);
        return;
      case MATERIAL_FLOW_STEPS.awaitingQuality:
        await this.handleMaterialQuality(input.chatId, input.phoneE164, state, input.text);
        return;
      case "AWAITING_INSPECT_DATE":
        await this.resetToMenu(input.chatId, input.phoneE164);
        return;
      case "SELECT_EMPRESA_FOR_REPORT":
        await this.handleEmpresaSelectionForReport(input.chatId, input.phoneE164, input.user.id, state, input.text);
        return;
      case "AWAITING_REPORT_DATE":
        await this.handleReportDate(input.chatId, input.phoneE164, state, input.text);
        return;
      case "SELECT_EMPRESA_FOR_TRAINING":
        await this.handleEmpresaSelectionForTraining(input.chatId, input.phoneE164, input.user.id, state, input.text);
        return;
      case "AWAITING_TRAINING_TEMA":
        await this.handleTrainingTema(input.chatId, input.phoneE164, state, input.text);
        return;
      case "AWAITING_TRAINING_PARTICIPANTS":
        await this.handleTrainingParticipants(input.chatId, input.phoneE164, state, input.text);
        return;
      case "AWAITING_TRAINING_DATES":
        await this.handleTrainingDates(input.chatId, input.phoneE164, input.user.id, state, input.text);
        return;
      case "AWAITING_TRAINING_PHOTO":
        await this.handleTrainingPhoto(input.chatId, input.phoneE164, input.user.id, state, input.payload);
        return;
      case "AWAITING_TRAINING_FILE":
        await this.handleTrainingFile(input.chatId, input.phoneE164, input.user.id, state, input.payload);
        return;
      default:
        await this.resetToMenu(input.chatId, input.phoneE164);
    }
  }

  // ---- Obra (etapa inicial, antes de qualquer menu) ------------------------

  private async resolveObraThenStart(chatId: string, phoneE164: string): Promise<void> {
    const obras = await this.deps.store.findObrasAtivas();
    if (obras.length === 0) {
      await this.deps.store.clearState(chatId);
      await this.deps.messaging.sendText(chatId, noObrasText());
      return;
    }

    if (obras.length === 1) {
      await this.goToMainMenu(chatId, phoneE164, obras[0].id, obras[0].nome, obraSelecionadaText(obras[0].nome));
      return;
    }

    await this.saveState({
      chatId,
      phoneE164,
      step: "SELECT_EMPRESA",
      stepKey: OBRA_FLOW_STEPS.selectObra,
      selectedTipo: null,
      selectedEmpresaId: null,
      selectedObraId: null,
      selectedObraNome: null,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      pendingEntradaId: null
    });
    await this.deps.messaging.sendText(chatId, obraMenuText(obras));
  }

  /** "trocar obra": mesma pergunta, mas sem apagar o cadastro do usuario alem do contexto de obra. */
  private async resolveObraForSwitch(chatId: string, phoneE164: string): Promise<void> {
    const obras = await this.deps.store.findObrasAtivas();
    if (obras.length === 0) {
      await this.deps.messaging.sendText(chatId, noObrasText());
      return;
    }

    await this.saveState({
      chatId,
      phoneE164,
      step: "SELECT_EMPRESA",
      stepKey: OBRA_FLOW_STEPS.selectObra,
      selectedTipo: null,
      selectedEmpresaId: null,
      selectedObraId: null,
      selectedObraNome: null,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      pendingEntradaId: null
    });
    await this.deps.messaging.sendText(chatId, obraMenuText(obras));
  }

  private async handleObraSelection(chatId: string, phoneE164: string, text: string): Promise<void> {
    const obras = await this.deps.store.findObrasAtivas();
    const selectedIndex = Number(text) - 1;
    const obra = Number.isInteger(selectedIndex) ? obras[selectedIndex] : undefined;
    if (!obra) {
      await this.deps.messaging.sendText(chatId, "⚠️ Não achei essa obra. Digite o numero da obra na lista acima.");
      return;
    }

    await this.goToMainMenu(chatId, phoneE164, obra.id, obra.nome, obraSelecionadaText(obra.nome));
  }

  /** Ponto unico de retorno ao menu principal — sempre dentro de uma obra ja definida. */
  private async goToMainMenu(
    chatId: string,
    phoneE164: string,
    obraId: number,
    obraNome: string,
    prefixText?: string
  ): Promise<void> {
    await this.saveState({
      chatId,
      phoneE164,
      step: "MAIN_MENU",
      selectedTipo: null,
      selectedEmpresaId: null,
      selectedObraId: obraId,
      selectedObraNome: obraNome,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      selectedTreinamentoTema: null,
      selectedTreinamentoParticipantes: null,
      selectedTreinamentoInicio: null,
      selectedTreinamentoFim: null,
      selectedTrainingPhotoCount: null,
      pendingEntradaId: null
    });

    const menu = mainMenuText();
    await this.deps.messaging.sendText(chatId, prefixText ? `${prefixText}\n\n${menu}` : withObraHeader(obraNome, menu));
  }

  // ---- Menu principal e categorias ------------------------------------------

  private async handleMainMenu(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    const obraId = state.selectedObraId;
    const obraNome = state.selectedObraNome;
    if (!obraId || !obraNome) {
      await this.resolveObraThenStart(chatId, phoneE164);
      return;
    }

    if (text === DIARIO_OBRA_REPORT_OPTION) {
      await this.handleConsultaForTipo(chatId, phoneE164, userId, state, DIARIO_OBRA_REPORT_TIPO);
      return;
    }

    const tipo = TIPO_OPTIONS[text];
    if (!tipo) {
      await this.sendWithHeader(chatId, obraNome, "⚠️ Não entendi. Digite um numero de 1 a 7.");
      return;
    }

    if (tipo === "Treinamento") {
      await this.resolveEmpresaForTraining(chatId, phoneE164, userId, obraId, obraNome);
      return;
    }

    await this.saveState({
      ...state,
      chatId,
      phoneE164,
      step: "ACTION_MENU",
      selectedTipo: tipo,
      selectedEmpresaId: null,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      pendingEntradaId: null
    });

    await this.sendWithHeader(chatId, obraNome, actionMenuText(tipo));
  }

  private async handleActionMenu(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    const tipo = this.requireSelectedTipo(state);
    if (!tipo || !state.selectedObraId || !state.selectedObraNome) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    if (usesIncludeOnlyActionMenu(tipo)) {
      if (text === INCLUDE_ONLY_ACTION_OPTIONS.incluir) {
        await this.resolveEmpresaForAdd(chatId, phoneE164, userId, state, tipo);
        return;
      }

      await this.sendWithHeader(chatId, state.selectedObraNome, "⚠️ Não entendi. Digite 1 pra incluir (ou 0 pra voltar).");
      return;
    }

    if (text === ACTION_OPTIONS.consulta) {
      await this.handleConsulta(chatId, phoneE164, userId, state);
      return;
    }

    if (text === ACTION_OPTIONS.incluir) {
      await this.resolveEmpresaForAdd(chatId, phoneE164, userId, state, tipo);
      return;
    }

    await this.sendWithHeader(chatId, state.selectedObraNome, "⚠️ Não entendi. Digite 1 ou 2 (ou 0 pra voltar).");
  }

  private async resolveEmpresaForAdd(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    tipo: EntryTipo
  ): Promise<void> {
    const obraId = state.selectedObraId!;
    const obraNome = state.selectedObraNome!;

    const empresas = await this.deps.store.findEmpresasByUser(userId);
    if (empresas.length === 0) {
      await this.deps.store.clearState(chatId);
      await this.deps.messaging.sendText(chatId, NENHUMA_EMPRESA_TEXT);
      return;
    }

    if (empresas.length === 1) {
      await this.askServiceType(chatId, phoneE164, tipo, empresas[0].id, obraId, obraNome);
      return;
    }

    await this.saveState({
      ...state,
      chatId,
      phoneE164,
      step: "SELECT_EMPRESA",
      selectedTipo: tipo,
      selectedEmpresaId: null,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      pendingEntradaId: null
    });
    await this.sendWithHeader(chatId, obraNome, this.empresaMenuText(empresas));
  }

  private async handleEmpresaSelection(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    const tipo = this.requireSelectedTipo(state);
    if (!tipo || !state.selectedObraId || !state.selectedObraNome) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const empresas = await this.deps.store.findEmpresasByUser(userId);
    const selectedIndex = Number(text) - 1;
    const empresa = Number.isInteger(selectedIndex) ? empresas[selectedIndex] : undefined;
    if (!empresa) {
      await this.sendWithHeader(chatId, state.selectedObraNome, "⚠️ Não entendi. Digite o numero da empresa na lista acima.");
      return;
    }

    await this.askServiceType(chatId, phoneE164, tipo, empresa.id, state.selectedObraId, state.selectedObraNome);
  }

  private async askServiceType(
    chatId: string,
    phoneE164: string,
    tipo: EntryTipo,
    empresaId: bigint,
    obraId: number,
    obraNome: string
  ): Promise<void> {
    if (tipo === MATERIAL_TIPO) {
      await this.saveState({
        chatId,
        phoneE164,
        step: "AWAITING_PROCEDURE_NUMBER",
        stepKey: MATERIAL_FLOW_STEPS.awaitingOs,
        selectedTipo: tipo,
        selectedEmpresaId: empresaId,
        selectedObraId: obraId,
        selectedObraNome: obraNome,
        selectedTipoServico: null,
        selectedNumeroProcedimento: null,
        pendingEntradaId: null,
        flowData: {}
      });
      await this.sendWithHeader(chatId, obraNome, materialOsPromptText());
      return;
    }

    await this.saveState({
      chatId,
      phoneE164,
      step: "AWAITING_SERVICE_TYPE",
      selectedTipo: tipo,
      selectedEmpresaId: empresaId,
      selectedObraId: obraId,
      selectedObraNome: obraNome,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      pendingEntradaId: null
    });
    await this.sendWithHeader(chatId, obraNome, tipoServicoMenuText(tipo));
  }

  private async resolveEmpresaForTraining(
    chatId: string,
    phoneE164: string,
    userId: number,
    obraId: number,
    obraNome: string
  ): Promise<void> {
    const empresas = await this.deps.store.findEmpresasByUser(userId);
    if (empresas.length === 0) {
      await this.deps.store.clearState(chatId);
      await this.deps.messaging.sendText(chatId, NENHUMA_EMPRESA_TEXT);
      return;
    }

    if (empresas.length === 1) {
      await this.startTrainingForEmpresa(chatId, phoneE164, empresas[0].id, obraId, obraNome);
      return;
    }

    await this.saveState({
      chatId,
      phoneE164,
      step: "SELECT_EMPRESA_FOR_TRAINING",
      selectedTipo: "Treinamento",
      selectedEmpresaId: null,
      selectedObraId: obraId,
      selectedObraNome: obraNome,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      selectedTreinamentoTema: null,
      selectedTreinamentoParticipantes: null,
      selectedTreinamentoInicio: null,
      selectedTreinamentoFim: null,
      selectedTrainingPhotoCount: null,
      pendingEntradaId: null
    });
    await this.sendWithHeader(chatId, obraNome, this.empresaMenuText(empresas));
  }

  private async handleEmpresaSelectionForTraining(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    if (!state.selectedObraId || !state.selectedObraNome) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const empresas = await this.deps.store.findEmpresasByUser(userId);
    const selectedIndex = Number(text) - 1;
    const empresa = Number.isInteger(selectedIndex) ? empresas[selectedIndex] : undefined;
    if (!empresa) {
      await this.sendWithHeader(chatId, state.selectedObraNome, "⚠️ Não entendi. Digite o numero da empresa na lista acima.");
      return;
    }

    await this.startTrainingForEmpresa(chatId, phoneE164, empresa.id, state.selectedObraId, state.selectedObraNome);
  }

  private async startTrainingForEmpresa(
    chatId: string,
    phoneE164: string,
    empresaId: bigint,
    obraId: number,
    obraNome: string
  ): Promise<void> {
    await this.saveState({
      chatId,
      phoneE164,
      step: "AWAITING_TRAINING_TEMA",
      selectedTipo: "Treinamento",
      selectedEmpresaId: empresaId,
      selectedObraId: obraId,
      selectedObraNome: obraNome,
      selectedTipoServico: null,
      selectedNumeroProcedimento: null,
      selectedTreinamentoTema: null,
      selectedTreinamentoParticipantes: null,
      selectedTreinamentoInicio: null,
      selectedTreinamentoFim: null,
      selectedTrainingPhotoCount: null,
      pendingEntradaId: null
    });
    await this.sendWithHeader(chatId, obraNome, trainingTemaPromptText());
  }

  private async handleTrainingTema(
    chatId: string,
    phoneE164: string,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    if (state.selectedTipo !== "Treinamento" || !state.selectedEmpresaId || !state.selectedObraNome) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const tema = text.trim();
    if (!tema) {
      await this.sendWithHeader(chatId, state.selectedObraNome, trainingTemaPromptText());
      return;
    }

    await this.saveState({
      ...state,
      chatId,
      phoneE164,
      step: "AWAITING_TRAINING_PARTICIPANTS",
      selectedTreinamentoTema: tema
    });
    await this.sendWithHeader(chatId, state.selectedObraNome, trainingParticipantsPromptText());
  }

  private async handleTrainingParticipants(
    chatId: string,
    phoneE164: string,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    if (
      state.selectedTipo !== "Treinamento" ||
      !state.selectedEmpresaId ||
      !state.selectedTreinamentoTema ||
      !state.selectedObraNome
    ) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const participantes = text.trim();
    if (!participantes) {
      await this.sendWithHeader(chatId, state.selectedObraNome, trainingParticipantsPromptText());
      return;
    }

    await this.saveState({
      ...state,
      chatId,
      phoneE164,
      step: "AWAITING_TRAINING_DATES",
      selectedTreinamentoParticipantes: participantes
    });
    await this.sendWithHeader(chatId, state.selectedObraNome, trainingDatesPromptText());
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
      !state.selectedTreinamentoParticipantes ||
      !state.selectedObraNome
    ) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const dateRange = parseTrainingDateRange(text);
    if (!dateRange) {
      await this.sendWithHeader(
        chatId,
        state.selectedObraNome,
        "⚠️ Não entendi essa data. Use o formato DD/MM/AAAA HH:mm - DD/MM/AAAA HH:mm."
      );
      return;
    }

    const treinamento = await this.deps.store.createTreinamento({
      userId,
      empresaId: state.selectedEmpresaId,
      obraId: state.selectedObraId ?? null,
      tema: state.selectedTreinamentoTema,
      participantes: state.selectedTreinamentoParticipantes,
      inicio: dateRange.inicio,
      fim: dateRange.fim
    });

    await this.saveState({
      ...state,
      chatId,
      phoneE164,
      step: "AWAITING_TRAINING_PHOTO",
      selectedTreinamentoInicio: dateRange.inicio,
      selectedTreinamentoFim: dateRange.fim,
      selectedTrainingPhotoCount: 0,
      pendingEntradaId: treinamento.entradaId
    });
    await this.sendWithHeader(chatId, state.selectedObraNome, trainingPhotoPromptText());
  }

  private async handleTrainingPhoto(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    payload: WahaMessagePayload
  ): Promise<void> {
    if (!state.selectedEmpresaId || !state.pendingEntradaId || !state.selectedObraNome) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const text = (payload.body ?? "").trim().toLowerCase();
    const photoCount = state.selectedTrainingPhotoCount ?? 0;
    if (TRAINING_PHOTO_DONE_COMMANDS.has(text)) {
      if (photoCount === 0) {
        await this.sendWithHeader(chatId, state.selectedObraNome, "📸 Preciso de pelo menos uma foto antes de continuar.");
        return;
      }

      await this.saveState({
        ...state,
        chatId,
        phoneE164,
        step: "AWAITING_TRAINING_FILE"
      });
      await this.sendWithHeader(chatId, state.selectedObraNome, trainingFilePromptText());
      return;
    }

    const uploaded = await this.handleTrainingMediaUpload({
      chatId,
      userId,
      state,
      payload,
      mediaTipo: TRAINING_MEDIA_TYPES.photo,
      allowedKinds: "image",
      missingMessage: "📸 Preciso de uma foto pra continuar. Manda ela aí.",
      invalidMessage: "⚠️ Isso nao e uma foto. Envie uma imagem (jpg ou png)."
    });
    if (!uploaded) {
      return;
    }

    await this.saveState({
      ...state,
      chatId,
      phoneE164,
      selectedTrainingPhotoCount: photoCount + 1
    });
    await this.sendWithHeader(chatId, state.selectedObraNome, "📸 Foto recebida! Envie outra ou digite OK pra continuar.");
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
      missingMessage: "📄 Envie a lista de presença em PDF ou foto.",
      invalidMessage: "⚠️ Precisa ser um PDF ou uma imagem. Envie novamente."
    });
    if (!uploaded) {
      return;
    }

    await this.deps.store.clearState(chatId);
    await this.deps.messaging.sendText(chatId, "✅ Treinamento registrado! Bom trabalho.");
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
        obraId: input.state.selectedObraId,
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
        "⚠️ Deu um problema pra salvar o arquivo. Tenta de novo em alguns instantes."
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
    if (!tipo || !state.selectedEmpresaId || !state.selectedObraId || !state.selectedObraNome) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const tipoServico = TIPO_SERVICO_OPTIONS[text];
    if (!tipoServico) {
      await this.sendWithHeader(chatId, state.selectedObraNome, "⚠️ Não entendi. Digite um numero de 1 a 7.");
      return;
    }

    await this.saveState({
      ...state,
      chatId,
      phoneE164,
      step: "AWAITING_PROCEDURE_NUMBER",
      selectedTipoServico: tipoServico,
      selectedNumeroProcedimento: null,
      pendingEntradaId: null
    });

    await this.sendWithHeader(chatId, state.selectedObraNome, numeroProcedimentoPromptText());
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
    if (!tipo || !state.selectedEmpresaId || !tipoServico || !state.selectedObraId || !state.selectedObraNome) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const numeroProcedimento = text.trim();
    if (!numeroProcedimento) {
      await this.sendWithHeader(chatId, state.selectedObraNome, numeroProcedimentoPromptText());
      return;
    }

    const empresa = await this.findSelectedEmpresaForUser(userId, state.selectedEmpresaId);
    await this.saveState({
      ...state,
      chatId,
      phoneE164,
      step: "AWAITING_PHOTO",
      selectedNumeroProcedimento: numeroProcedimento,
      pendingEntradaId: null
    });

    await this.sendWithHeader(
      chatId,
      state.selectedObraNome,
      photoPromptText(tipo, empresa, tipoServico, numeroProcedimento)
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
    if (
      !tipo ||
      !state.selectedEmpresaId ||
      !tipoServico ||
      !numeroProcedimento ||
      !state.selectedObraId ||
      !state.selectedObraNome
    ) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const media = payload.media;
    if (!payload.hasMedia || !media?.url) {
      await this.sendWithHeader(chatId, state.selectedObraNome, "📸 Preciso de uma foto pra continuar. Manda ela aí.");
      return;
    }

    const contentType = media.mimetype ?? "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      await this.sendWithHeader(chatId, state.selectedObraNome, "⚠️ Isso nao e uma foto. Envie uma imagem (jpg ou png).");
      return;
    }

    try {
      const body = await this.deps.mediaDownloader.download(media.url);
      const objectPath = buildStoragePath({
        empresaId: state.selectedEmpresaId,
        userId,
        obraId: state.selectedObraId,
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
        obraId: state.selectedObraId,
        tipo,
        tipoServico,
        numeroProcedimento,
        description: ""
      });

      await this.deps.store.addEntradaMedia({
        entradaId: entrada.id,
        mediaUrl: objectPath
      });

      await this.saveState({
        ...state,
        chatId,
        phoneE164,
        step: "AWAITING_DESCRIPTION",
        pendingEntradaId: entrada.id
      });

      await this.sendWithHeader(chatId, state.selectedObraNome, "📸 Foto recebida! 📝 Agora me conta o que foi feito.");
    } catch (error) {
      console.error("Failed to process WhatsApp photo", error);
      await this.sendWithHeader(
        chatId,
        state.selectedObraNome,
        "⚠️ Deu um problema pra salvar a foto. Tenta enviar de novo em alguns instantes."
      );
    }
  }

  private async handleDescription(chatId: string, state: ConversationStateRecord, text: string): Promise<void> {
    if (!state.pendingEntradaId) {
      await this.deps.store.clearState(chatId);
      await this.deps.messaging.sendText(chatId, mainMenuText());
      return;
    }

    if (!text) {
      await this.sendWithHeader(chatId, state.selectedObraNome, "📝 Preciso de uma descricao em texto pra concluir.");
      return;
    }

    await this.deps.store.updateEntradaDescription(state.pendingEntradaId, text);

    if (!state.selectedObraId || !state.selectedObraNome) {
      await this.deps.store.clearState(chatId);
      await this.deps.messaging.sendText(chatId, "✅ Registro salvo! Já tá no diario da obra.");
      return;
    }

    await this.saveState({
      ...state,
      chatId,
      phoneE164: state.phoneE164,
      step: "AWAITING_POST_SAVE_CHOICE",
      selectedNumeroProcedimento: null,
      pendingEntradaId: null
    });
    await this.sendWithHeader(chatId, state.selectedObraNome, postSaveMenuText());
  }

  private async handlePostSaveChoice(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    const tipo = this.requireSelectedTipo(state);
    if (!tipo || !state.selectedObraId || !state.selectedObraNome) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    if (text === POST_SAVE_OPTIONS.novoRegistro) {
      await this.resolveEmpresaForAdd(chatId, phoneE164, userId, state, tipo);
      return;
    }

    if (text === POST_SAVE_OPTIONS.voltarMenu) {
      await this.goToMainMenu(chatId, phoneE164, state.selectedObraId, state.selectedObraNome);
      return;
    }

    await this.sendWithHeader(chatId, state.selectedObraNome, "⚠️ Digite 1 pra incluir outro registro ou 2 pra voltar ao menu.");
  }

  private async handleMaterialOs(
    chatId: string,
    phoneE164: string,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    if (state.selectedTipo !== MATERIAL_TIPO || !state.selectedEmpresaId || !state.selectedObraNome) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const numeroOs = text.trim();
    if (!numeroOs) {
      await this.sendWithHeader(chatId, state.selectedObraNome, materialOsPromptText());
      return;
    }

    await this.saveState({
      ...state,
      chatId,
      phoneE164,
      step: "AWAITING_PHOTO",
      stepKey: MATERIAL_FLOW_STEPS.awaitingNotaPhoto,
      selectedNumeroProcedimento: numeroOs,
      pendingEntradaId: null,
      flowData: {}
    });
    await this.sendWithHeader(chatId, state.selectedObraNome, materialNotaPhotoPromptText());
  }

  private async handleMaterialNotaPhoto(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    payload: WahaMessagePayload
  ): Promise<void> {
    const numeroOs = state.selectedNumeroProcedimento?.trim();
    if (state.selectedTipo !== MATERIAL_TIPO || !state.selectedEmpresaId || !numeroOs || !state.selectedObraNome) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const objectPath = await this.uploadMaterialImage({
      chatId,
      userId,
      empresaId: state.selectedEmpresaId,
      obraId: state.selectedObraId,
      payload,
      missingMessage: "📸 Preciso da foto da nota pra continuar.",
      invalidMessage: "⚠️ Isso nao e uma foto. Envie uma imagem (jpg ou png)."
    });
    if (!objectPath) {
      return;
    }

    try {
      const entrada = await this.deps.store.createEntrada({
        userId,
        empresaId: state.selectedEmpresaId,
        obraId: state.selectedObraId ?? null,
        tipo: MATERIAL_TIPO,
        tipoServico: null,
        numeroProcedimento: numeroOs,
        description: ""
      });

      await this.deps.store.addEntradaMedia({
        entradaId: entrada.id,
        mediaUrl: objectPath,
        mediaTipo: MATERIAL_MEDIA_TYPES.nota
      });

      await this.saveState({
        ...state,
        chatId,
        phoneE164,
        step: "AWAITING_PHOTO",
        stepKey: MATERIAL_FLOW_STEPS.awaitingMaterialPhoto,
        pendingEntradaId: entrada.id,
        flowData: {}
      });
      await this.sendWithHeader(chatId, state.selectedObraNome, materialPhotoPromptText());
    } catch (error) {
      console.error("Failed to save material receipt note photo", error);
      await this.sendWithHeader(
        chatId,
        state.selectedObraNome,
        "⚠️ Deu um problema pra salvar a foto. Tenta enviar de novo em alguns instantes."
      );
    }
  }

  private async handleMaterialPhoto(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    payload: WahaMessagePayload
  ): Promise<void> {
    const numeroOs = state.selectedNumeroProcedimento?.trim();
    if (
      state.selectedTipo !== MATERIAL_TIPO ||
      !state.selectedEmpresaId ||
      !state.pendingEntradaId ||
      !numeroOs ||
      !state.selectedObraNome
    ) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const objectPath = await this.uploadMaterialImage({
      chatId,
      userId,
      empresaId: state.selectedEmpresaId,
      obraId: state.selectedObraId,
      payload,
      missingMessage: "📸 Preciso da foto do material pra continuar.",
      invalidMessage: "⚠️ Isso nao e uma foto. Envie uma imagem (jpg ou png)."
    });
    if (!objectPath) {
      return;
    }

    try {
      await this.deps.store.addEntradaMedia({
        entradaId: state.pendingEntradaId,
        mediaUrl: objectPath,
        mediaTipo: MATERIAL_MEDIA_TYPES.material
      });

      await this.saveState({
        ...state,
        chatId,
        phoneE164,
        step: "AWAITING_DESCRIPTION",
        stepKey: MATERIAL_FLOW_STEPS.awaitingQuantity,
        flowData: {}
      });
      await this.sendWithHeader(chatId, state.selectedObraNome, materialQuantityPromptText());
    } catch (error) {
      console.error("Failed to save material receipt material photo", error);
      await this.sendWithHeader(
        chatId,
        state.selectedObraNome,
        "⚠️ Deu um problema pra salvar a foto. Tenta enviar de novo em alguns instantes."
      );
    }
  }

  private async handleMaterialQuantity(
    chatId: string,
    phoneE164: string,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    if (state.selectedTipo !== MATERIAL_TIPO || !state.pendingEntradaId || !state.selectedObraNome) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const answer = parseMaterialAnswer(text);
    if (!answer) {
      await this.sendWithHeader(chatId, state.selectedObraNome, "⚠️ Digite 1 pra Sim ou 2 pra Não.");
      return;
    }

    await this.saveState({
      ...state,
      chatId,
      phoneE164,
      step: "AWAITING_DESCRIPTION",
      stepKey: MATERIAL_FLOW_STEPS.awaitingQuality,
      flowData: {
        ...flowDataObject(state.flowData),
        [MATERIAL_FLOW_DATA_KEYS.quantidadeCorreta]: answer
      }
    });
    await this.sendWithHeader(chatId, state.selectedObraNome, materialQualityPromptText());
  }

  private async handleMaterialQuality(
    chatId: string,
    phoneE164: string,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    if (state.selectedTipo !== MATERIAL_TIPO || !state.pendingEntradaId) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const quantidadeCorreta = materialAnswerFromData(
      state.flowData,
      MATERIAL_FLOW_DATA_KEYS.quantidadeCorreta
    );
    if (!quantidadeCorreta) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const qualidadeCorreta = parseMaterialAnswer(text);
    if (!qualidadeCorreta) {
      await this.sendWithHeader(chatId, state.selectedObraNome, "⚠️ Digite 1 pra Sim ou 2 pra Não.");
      return;
    }

    await this.deps.store.updateEntradaDescription(
      state.pendingEntradaId,
      buildMaterialDescription(quantidadeCorreta, qualidadeCorreta)
    );
    await this.deps.store.clearState(chatId);
    await this.deps.messaging.sendText(chatId, "✅ Recebimento de material registrado! Bom trabalho.");
  }

  private async uploadMaterialImage(input: {
    chatId: string;
    userId: number;
    empresaId: bigint;
    obraId?: number | null;
    payload: WahaMessagePayload;
    missingMessage: string;
    invalidMessage: string;
  }): Promise<string | null> {
    const media = input.payload.media;
    if (!input.payload.hasMedia || !media?.url) {
      await this.deps.messaging.sendText(input.chatId, input.missingMessage);
      return null;
    }

    const contentType = media.mimetype ?? "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      await this.deps.messaging.sendText(input.chatId, input.invalidMessage);
      return null;
    }

    try {
      const body = await this.deps.mediaDownloader.download(media.url);
      const objectPath = buildStoragePath({
        empresaId: input.empresaId,
        userId: input.userId,
        obraId: input.obraId,
        messageId: input.payload.id,
        filename: media.filename,
        contentType
      });

      await this.deps.objectStorage.uploadPrivateObject({
        path: objectPath,
        body,
        contentType
      });

      return objectPath;
    } catch (error) {
      console.error("Failed to process WhatsApp material receipt photo", error);
      await this.deps.messaging.sendText(
        input.chatId,
        "⚠️ Deu um problema pra salvar a foto. Tenta enviar de novo em alguns instantes."
      );
      return null;
    }
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

    await this.handleConsultaForTipo(chatId, phoneE164, userId, state, tipo);
  }

  private async handleConsultaForTipo(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    tipo: EntryTipo
  ): Promise<void> {
    const obraId = state.selectedObraId;
    const obraNome = state.selectedObraNome;
    if (!obraId || !obraNome) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const empresas = await this.deps.store.findEmpresasByUser(userId);
    if (empresas.length === 0) {
      await this.deps.store.clearState(chatId);
      await this.deps.messaging.sendText(chatId, NENHUMA_EMPRESA_TEXT);
      return;
    }

    if (empresas.length === 1) {
      await this.saveState({
        ...state,
        chatId,
        phoneE164,
        step: "AWAITING_REPORT_DATE",
        selectedTipo: tipo,
        selectedEmpresaId: empresas[0].id,
        pendingEntradaId: null
      });
      await this.sendWithHeader(chatId, obraNome, "📄 Qual data voce quer no relatorio? Formato: DD/MM/AAAA");
      return;
    }

    await this.saveState({
      ...state,
      chatId,
      phoneE164,
      step: "SELECT_EMPRESA_FOR_REPORT",
      selectedTipo: tipo,
      selectedEmpresaId: null,
      pendingEntradaId: null
    });
    await this.sendWithHeader(chatId, obraNome, this.empresaMenuText(empresas));
  }

  private async handleEmpresaSelectionForReport(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    const tipo = this.requireSelectedTipo(state);
    if (!tipo || !state.selectedObraNome) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const empresas = await this.deps.store.findEmpresasByUser(userId);
    const selectedIndex = Number(text) - 1;
    const empresa = Number.isInteger(selectedIndex) ? empresas[selectedIndex] : undefined;
    if (!empresa) {
      await this.sendWithHeader(chatId, state.selectedObraNome, "⚠️ Não entendi. Digite o numero da empresa na lista acima.");
      return;
    }

    await this.saveState({
      ...state,
      chatId,
      phoneE164,
      step: "AWAITING_REPORT_DATE",
      selectedEmpresaId: empresa.id,
      pendingEntradaId: null
    });
    await this.sendWithHeader(chatId, state.selectedObraNome, "📄 Qual data voce quer no relatorio? Formato: DD/MM/AAAA");
  }

  private async handleReportDate(
    chatId: string,
    phoneE164: string,
    state: ConversationStateRecord,
    text: string
  ): Promise<void> {
    const tipo = this.requireSelectedTipo(state);
    if (!tipo || !state.selectedEmpresaId || !state.selectedObraNome) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const dateRange = parseReportDate(text);
    if (!dateRange) {
      await this.sendWithHeader(chatId, state.selectedObraNome, "⚠️ Não entendi essa data. Use o formato DD/MM/AAAA.");
      return;
    }

    await this.sendWithHeader(chatId, state.selectedObraNome, "📄 Gerando o relatorio, so um instante...");

    const entradas = await this.deps.store.findEntradasForReport({
      empresaId: state.selectedEmpresaId,
      obraId: state.selectedObraId ?? null,
      tipo,
      dateStart: dateRange.start,
      dateEnd: dateRange.end
    });

    if (entradas.length === 0) {
      await this.deps.store.clearState(chatId);
      await this.sendWithHeader(chatId, state.selectedObraNome, `📄 Nenhum registro encontrado em ${text}.\n\n${mainMenuText()}`);
      return;
    }

    const empresaNome = entradas[0].empresaNome ?? `Empresa ${state.selectedEmpresaId.toString()}`;
    const pdfBuffer = await this.deps.pdfGenerator.generateReport({
      categoria: tipo,
      empresaNome,
      obraNome: state.selectedObraNome,
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
    await this.sendWithHeader(chatId, state.selectedObraNome, mainMenuText());
  }

  private async saveState(input: SaveConversationStateInput): Promise<ConversationStateRecord> {
    const stepKey =
      isMaterialFlowStepKey(input.stepKey) || isObraFlowStepKey(input.stepKey) ? input.stepKey : input.step;

    return this.deps.store.saveState({
      ...input,
      flowKey: this.key,
      stepKey,
      flowData: buildDiarioFlowData(input)
    });
  }

  private async sendWithHeader(chatId: string, obraNome: string | null | undefined, message: string): Promise<void> {
    await this.deps.messaging.sendText(chatId, obraNome ? withObraHeader(obraNome, message) : message);
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

  private requireSelectedTipoServico(state: ConversationStateRecord) {
    if (isTipoServico(state.selectedTipoServico)) {
      return state.selectedTipoServico;
    }

    return null;
  }

  private empresaMenuText(empresas: EmpresaRecord[]): string {
    const options = empresas
      .map((empresa, index) => `${index + 1}) ${empresa.nome ?? `Empresa ${empresa.id.toString()}`}`)
      .join("\n");

    return `🏢 Qual empresa?\n${options}\n\nDigite o numero da empresa.`;
  }
}

function buildDiarioFlowData(input: SaveConversationStateInput): FlowData {
  const data = flowDataObject(input.flowData);

  return {
    ...data,
    selectedTipo: input.selectedTipo ?? null,
    selectedEmpresaId: input.selectedEmpresaId?.toString() ?? null,
    selectedObraId: input.selectedObraId ?? null,
    selectedObraNome: input.selectedObraNome ?? null,
    selectedTipoServico: input.selectedTipoServico ?? null,
    selectedNumeroProcedimento: input.selectedNumeroProcedimento ?? null,
    selectedTreinamentoTema: input.selectedTreinamentoTema ?? null,
    selectedTreinamentoParticipantes: input.selectedTreinamentoParticipantes ?? null,
    selectedTreinamentoInicio: input.selectedTreinamentoInicio?.toISOString() ?? null,
    selectedTreinamentoFim: input.selectedTreinamentoFim?.toISOString() ?? null,
    selectedTrainingPhotoCount: input.selectedTrainingPhotoCount ?? null,
    pendingEntradaId: input.pendingEntradaId?.toString() ?? null
  };
}

function hydrateDiarioState(state: ConversationStateRecord): ConversationStateRecord {
  const data = flowDataObject(state.flowData);

  return {
    ...state,
    selectedTipo: state.selectedTipo ?? stringFromData(data.selectedTipo),
    selectedEmpresaId: state.selectedEmpresaId ?? bigintFromData(data.selectedEmpresaId),
    selectedObraId: state.selectedObraId ?? numberFromData(data.selectedObraId),
    selectedObraNome: state.selectedObraNome ?? stringFromData(data.selectedObraNome),
    selectedTipoServico: state.selectedTipoServico ?? stringFromData(data.selectedTipoServico),
    selectedNumeroProcedimento:
      state.selectedNumeroProcedimento ?? stringFromData(data.selectedNumeroProcedimento),
    selectedTreinamentoTema: state.selectedTreinamentoTema ?? stringFromData(data.selectedTreinamentoTema),
    selectedTreinamentoParticipantes:
      state.selectedTreinamentoParticipantes ?? stringFromData(data.selectedTreinamentoParticipantes),
    selectedTreinamentoInicio: state.selectedTreinamentoInicio ?? dateFromData(data.selectedTreinamentoInicio),
    selectedTreinamentoFim: state.selectedTreinamentoFim ?? dateFromData(data.selectedTreinamentoFim),
    selectedTrainingPhotoCount:
      state.selectedTrainingPhotoCount ?? numberFromData(data.selectedTrainingPhotoCount),
    pendingEntradaId: state.pendingEntradaId ?? bigintFromData(data.pendingEntradaId)
  };
}

function flowDataObject(value: FlowData | null | undefined): FlowData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

function materialAnswerFromData(
  flowData: FlowData | null | undefined,
  key: (typeof MATERIAL_FLOW_DATA_KEYS)[keyof typeof MATERIAL_FLOW_DATA_KEYS]
): MaterialAnswer | null {
  const value = flowDataObject(flowData)[key];
  return value === "Sim" || value === "Não" ? value : null;
}

function buildMaterialDescription(quantidadeCorreta: MaterialAnswer, qualidadeCorreta: MaterialAnswer): string {
  return `Quantidade correta: ${quantidadeCorreta}\nQualidade correta: ${qualidadeCorreta}`;
}

function stringFromData(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberFromData(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bigintFromData(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  return BigInt(value);
}

function dateFromData(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

  return new Date(Date.UTC(year, month - 1, day, hour + 3, minute, 0, 0));
}

function buildStoragePath(input: {
  empresaId: bigint;
  userId: number;
  obraId?: number | null;
  messageId?: string;
  filename?: string | null;
  contentType: string;
}): string {
  const date = new Date().toISOString().slice(0, 10);
  const extension = extensionFrom(input.filename, input.contentType);
  const messageId = input.messageId ?? `${Date.now()}`;
  const safeMessageId = messageId.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const obraSegment = input.obraId != null ? `obras/${input.obraId}` : "obras/sem-obra";

  return `entradas/${input.empresaId.toString()}/${obraSegment}/${date}/${input.userId}_${safeMessageId}.${extension}`;
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
