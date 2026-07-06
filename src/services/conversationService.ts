import { createFlowRegistry, type FlowRegistry } from "../flows/registry";
import type { ConversationServiceDeps, ConversationStateRecord, UserRecord } from "../flows/types";
import type { WahaMessagePayload, WahaWebhook } from "../types/waha";
import {
  extractPhoneFromWahaPayload,
  getWahaPhoneLookupCandidates,
  readNestedString
} from "../utils/phone";

export type {
  ConversationServiceDeps,
  ConversationStateRecord,
  ConversationStore,
  CreateEntradaInput,
  CreateTreinamentoInput,
  EmpresaRecord,
  EntradaForReport,
  FlowData,
  FlowDefinition,
  FlowHandleInput,
  FlowStep,
  MediaDownloader,
  MessagingClient,
  ObjectStorage,
  ObraRecord,
  PdfGenerator,
  ReportInput,
  SaveConversationStateInput,
  UserRecord
} from "../flows/types";

const RESET_COMMANDS = new Set(["0", "menu", "cancelar"]);

export class ConversationService {
  private readonly flowRegistry: FlowRegistry;
  private readonly chatLocks = new Map<string, Promise<void>>();

  constructor(private readonly deps: ConversationServiceDeps) {
    this.flowRegistry = createFlowRegistry(deps);
  }

  async handleWebhook(webhook: WahaWebhook): Promise<void> {
    if (!this.isSupportedWebhook(webhook)) {
      return;
    }

    const payload = webhook.payload;
    const chatId = payload.from ?? payload.chatId;
    if (!chatId) {
      return;
    }

    await this.withChatLock(chatId, () => this.processWebhook(chatId, webhook));
  }

  private async withChatLock<T>(chatId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.chatLocks.get(chatId) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.chatLocks.set(chatId, prev.then(() => next));
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.chatLocks.get(chatId) === next) {
        this.chatLocks.delete(chatId);
      }
    }
  }

  private async processWebhook(
    chatId: string,
    webhook: WahaWebhook & { payload: WahaMessagePayload }
  ): Promise<void> {
    const payload = webhook.payload;
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
      await this.flowRegistry.defaultFlow.resetToMenu(chatId, phoneE164);
      return;
    }

    const loadedState = await this.deps.store.getState(chatId);
    this.logWahaDebug("WAHA conversation state loaded", {
      chatId,
      phoneE164,
      userId: user.id,
      stateStep: loadedState?.stepKey ?? loadedState?.step ?? null,
      flowKey: loadedState?.flowKey ?? null,
      hasMedia: payload.hasMedia ?? false,
      textLength: text.length
    });

    if (!loadedState) {
      const state = await this.createInitialState(chatId, phoneE164);
      this.logWahaDebug("WAHA conversation state created", {
        chatId,
        phoneE164,
        userId: user.id,
        flowKey: state.flowKey,
        step: state.stepKey ?? state.step
      });

      await this.flowRegistry.defaultFlow.start({
        chatId,
        phoneE164,
        user,
        state,
        text,
        payload
      });
      return;
    }

    const flow = this.flowRegistry.get(loadedState.flowKey) ?? this.flowRegistry.defaultFlow;
    await flow.handle({
      chatId,
      phoneE164,
      user,
      state: loadedState,
      text,
      payload
    });
  }

  private async createInitialState(chatId: string, phoneE164: string): Promise<ConversationStateRecord> {
    return this.deps.store.saveState({
      chatId,
      phoneE164,
      step: "MAIN_MENU",
      flowKey: this.flowRegistry.defaultFlow.key,
      stepKey: "MAIN_MENU",
      flowData: {},
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

  private isResetCommand(text: string): boolean {
    return RESET_COMMANDS.has(text.toLowerCase());
  }
}

function isWahaDebugLoggingEnabled(): boolean {
  const value = process.env.WAHA_DEBUG_LOGS?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
