import type { WahaMessagePayload, WahaWebhook } from "../types/waha";
import { extractPhoneFromWahaPayload } from "../utils/phone";

export type FlowStep =
  | "MAIN_MENU"
  | "ACTION_MENU"
  | "SELECT_EMPRESA"
  | "AWAITING_PHOTO"
  | "AWAITING_DESCRIPTION"
  | "AWAITING_INSPECT_DATE";

export type EntryTipo = "Diario de obra" | "Manutencao";

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
  pendingEntradaId?: bigint | null;
}

export interface SaveConversationStateInput extends ConversationStateRecord {}

export interface CreateEntradaInput {
  userId: number;
  empresaId: bigint;
  tipo: EntryTipo;
  description: string;
}

export interface ConversationStore {
  findUserByPhone(phoneDigits: string): Promise<UserRecord | null>;
  findEmpresasByUser(userId: number): Promise<EmpresaRecord[]>;
  getState(chatId: string): Promise<ConversationStateRecord | null>;
  saveState(input: SaveConversationStateInput): Promise<ConversationStateRecord>;
  clearState(chatId: string): Promise<void>;
  createEntrada(input: CreateEntradaInput): Promise<{ id: bigint }>;
  addEntradaMedia(input: { entradaId: bigint; mediaUrl: string }): Promise<void>;
  updateEntradaDescription(entradaId: bigint, description: string): Promise<void>;
}

export interface MessagingClient {
  sendText(chatId: string, text: string): Promise<void>;
}

export interface MediaDownloader {
  download(url: string): Promise<Buffer>;
}

export interface ObjectStorage {
  uploadPrivateObject(input: { path: string; body: Buffer; contentType: string }): Promise<void>;
}

export interface ConversationServiceDeps {
  store: ConversationStore;
  messaging: MessagingClient;
  mediaDownloader: MediaDownloader;
  objectStorage: ObjectStorage;
}

const TIPO_OPTIONS: Record<string, EntryTipo> = {
  "1": "Diario de obra",
  "2": "Manutencao"
};

const ACTION_OPTIONS = {
  inspect: "1",
  add: "2"
};

const RESET_COMMANDS = new Set(["0", "menu", "cancelar"]);

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

    const phoneE164 = extractPhoneFromWahaPayload(payload);
    const user = await this.deps.store.findUserByPhone(phoneE164);
    if (!user) {
      await this.deps.messaging.sendText(
        chatId,
        "Numero nao cadastrado. Fale com o administrador para liberar o acesso."
      );
      return;
    }

    const text = (payload.body ?? "").trim();
    if (this.isResetCommand(text)) {
      await this.resetToMenu(chatId, phoneE164);
      return;
    }

    const state = await this.deps.store.getState(chatId);
    if (!state) {
      await this.deps.store.saveState({
        chatId,
        phoneE164,
        step: "MAIN_MENU",
        selectedTipo: null,
        selectedEmpresaId: null,
        pendingEntradaId: null
      });
      await this.deps.messaging.sendText(chatId, this.mainMenuText());
      return;
    }

    switch (state.step) {
      case "MAIN_MENU":
        await this.handleMainMenu(chatId, phoneE164, text);
        return;
      case "ACTION_MENU":
        await this.handleActionMenu(chatId, phoneE164, user.id, state, text);
        return;
      case "SELECT_EMPRESA":
        await this.handleEmpresaSelection(chatId, phoneE164, user.id, state, text);
        return;
      case "AWAITING_PHOTO":
        await this.handlePhoto(chatId, phoneE164, user.id, state, payload);
        return;
      case "AWAITING_DESCRIPTION":
        await this.handleDescription(chatId, state, text);
        return;
      case "AWAITING_INSPECT_DATE":
        await this.handleInspectDate(chatId, text);
        return;
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

  private async handleMainMenu(chatId: string, phoneE164: string, text: string): Promise<void> {
    const tipo = TIPO_OPTIONS[text];
    if (!tipo) {
      await this.deps.messaging.sendText(chatId, `Opcao invalida.\n\n${this.mainMenuText()}`);
      return;
    }

    await this.deps.store.saveState({
      chatId,
      phoneE164,
      step: "ACTION_MENU",
      selectedTipo: tipo,
      selectedEmpresaId: null,
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

    if (text === ACTION_OPTIONS.inspect) {
      await this.deps.store.saveState({
        chatId,
        phoneE164,
        step: "AWAITING_INSPECT_DATE",
        selectedTipo: tipo,
        selectedEmpresaId: state.selectedEmpresaId ?? null,
        pendingEntradaId: null
      });
      await this.deps.messaging.sendText(chatId, "Informe a data para inspecionar no formato DD/MM/AAAA.");
      return;
    }

    if (text === ACTION_OPTIONS.add) {
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
        step: "AWAITING_PHOTO",
        selectedTipo: tipo,
        selectedEmpresaId: empresas[0].id,
        pendingEntradaId: null
      });
      await this.deps.messaging.sendText(chatId, this.photoPromptText(tipo, empresas[0]));
      return;
    }

    await this.deps.store.saveState({
      chatId,
      phoneE164,
      step: "SELECT_EMPRESA",
      selectedTipo: tipo,
      selectedEmpresaId: null,
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
      step: "AWAITING_PHOTO",
      selectedTipo: tipo,
      selectedEmpresaId: empresa.id,
      pendingEntradaId: null
    });
    await this.deps.messaging.sendText(chatId, this.photoPromptText(tipo, empresa));
  }

  private async handlePhoto(
    chatId: string,
    phoneE164: string,
    userId: number,
    state: ConversationStateRecord,
    payload: WahaMessagePayload
  ): Promise<void> {
    const tipo = this.requireSelectedTipo(state);
    if (!tipo || !state.selectedEmpresaId) {
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

  private async handleInspectDate(chatId: string, text: string): Promise<void> {
    if (!text) {
      await this.deps.messaging.sendText(chatId, "Informe a data para inspecionar no formato DD/MM/AAAA.");
      return;
    }

    await this.deps.store.clearState(chatId);
    await this.deps.messaging.sendText(
      chatId,
      "Resumo em PDF ainda nao implementado. A data solicitada foi registrada para a proxima versao."
    );
  }

  private async resetToMenu(chatId: string, phoneE164: string): Promise<void> {
    await this.deps.store.saveState({
      chatId,
      phoneE164,
      step: "MAIN_MENU",
      selectedTipo: null,
      selectedEmpresaId: null,
      pendingEntradaId: null
    });
    await this.deps.messaging.sendText(chatId, this.mainMenuText());
  }

  private isResetCommand(text: string): boolean {
    return RESET_COMMANDS.has(text.toLowerCase());
  }

  private requireSelectedTipo(state: ConversationStateRecord): EntryTipo | null {
    if (state.selectedTipo === "Diario de obra" || state.selectedTipo === "Manutencao") {
      return state.selectedTipo;
    }

    return null;
  }

  private mainMenuText(): string {
    return "O que voce quer acessar?\n1) Diario de obra\n2) Manutencao\n\nDigite 0 para voltar ao menu.";
  }

  private actionMenuText(tipo: EntryTipo): string {
    return `${tipo}\n1) Inspecionar\n2) Adicionar\n\nDigite 0 para voltar ao menu.`;
  }

  private empresaMenuText(empresas: EmpresaRecord[]): string {
    const options = empresas
      .map((empresa, index) => `${index + 1}) ${empresa.nome ?? `Empresa ${empresa.id.toString()}`}`)
      .join("\n");

    return `Escolha a empresa:\n${options}\n\nDigite 0 para voltar ao menu.`;
  }

  private photoPromptText(tipo: EntryTipo, empresa: EmpresaRecord): string {
    const empresaNome = empresa.nome ?? `Empresa ${empresa.id.toString()}`;
    return `${tipo} - ${empresaNome}\nEnvie uma foto para adicionar ao registro.`;
  }
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
    default:
      return "bin";
  }
}
