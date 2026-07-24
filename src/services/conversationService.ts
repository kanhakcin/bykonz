import { createFlowRegistry, type FlowRegistry } from "../flows/registry";
import type { ConversationServiceDeps, ConversationStateRecord, UserRecord } from "../flows/types";
import type { IncomingMessage } from "../types/message";
import { getWahaPhoneLookupCandidates } from "../utils/phone";

export type {
  ChannelOnboarding,
  ConversationServiceDeps,
  ConversationStateRecord,
  ConversationStore,
  CreateEntradaInput,
  CreateTreinamentoInput,
  DailyReportGenerator,
  DailyReportInput,
  EmpresaRecord,
  EntradaForReport,
  FlowData,
  FlowDefinition,
  FlowHandleInput,
  FlowStep,
  MediaDownloader,
  MessagingClient,
  ObjectStorage,
  ObraForReport,
  ObraRecord,
  PdfGenerator,
  ReportInput,
  SaveConversationStateInput,
  UserRecord
} from "../flows/types";

const RESET_COMMANDS = new Set(["0", "menu", "cancelar"]);

/** Sessao expira apos 1 hora sem mensagens; volta para a escolha de obra. */
const SESSION_TIMEOUT_MS = 60 * 60 * 1000;

export class ConversationService {
  private readonly flowRegistry: FlowRegistry;
  private readonly chatLocks = new Map<string, Promise<void>>();

  constructor(private readonly deps: ConversationServiceDeps) {
    this.flowRegistry = createFlowRegistry(deps);
  }

  /**
   * Recebe uma mensagem já normalizada (channel-agnóstica) pela borda de cada
   * canal. Toda a especificidade de WAHA/Telegram (filtro de evento/fromMe,
   * extração de telefone, resolução de file_id) vive nos adapters de entrada.
   */
  async handleWebhook(message: IncomingMessage): Promise<void> {
    const chatId = message.chatId;
    if (!chatId) {
      return;
    }

    await this.withChatLock(chatId, () => this.processMessage(message));
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

  private async processMessage(message: IncomingMessage): Promise<void> {
    const chatId = message.chatId;
    this.logChannelDebug("channel message received", {
      channel: message.channel,
      chatId,
      hasMedia: message.media != null,
      hasSharedContact: message.sharedContact != null,
      identityKind: message.identity.kind
    });

    // Onboarding do Telegram: o operador compartilhou o telefone para auto-
    // vincular o telegramUserId. Tratado antes da resolução de identidade.
    if (message.sharedContact && message.identity.kind === "telegram") {
      await this.handleSharedContact(chatId, message.identity.value, message.sharedContact);
      return;
    }

    const user = await this.resolveUser(message);
    if (!user) {
      this.logChannelDebug("channel identity did not match a registered user", {
        channel: message.channel,
        chatId,
        identityKind: message.identity.kind,
        identityValue: message.identity.value
      });
      // No Telegram, o bot não conhece o telefone do operador; em vez de só
      // recusar, oferece o botão de compartilhar contato para auto-vínculo.
      if (message.identity.kind === "telegram" && this.deps.channelOnboarding) {
        await this.deps.channelOnboarding.promptShareContact(chatId);
        return;
      }
      await this.deps.messaging.sendText(
        chatId,
        "Numero nao cadastrado. Fale com o administrador para liberar o acesso."
      );
      return;
    }

    const phoneE164 = user.phoneE164;
    this.logChannelDebug("channel identity matched registered user", {
      channel: message.channel,
      chatId,
      matchedPhoneE164: phoneE164,
      userId: user.id
    });

    const text = (message.text ?? "").trim();
    if (this.isResetCommand(text)) {
      this.logChannelDebug("reset command received", {
        chatId,
        phoneE164,
        userId: user.id,
        command: text.toLowerCase()
      });
      await this.flowRegistry.defaultFlow.resetToMenu(chatId, phoneE164);
      return;
    }

    const loadedState = await this.deps.store.getState(chatId);
    this.logChannelDebug("conversation state loaded", {
      chatId,
      phoneE164,
      userId: user.id,
      stateStep: loadedState?.stepKey ?? loadedState?.step ?? null,
      flowKey: loadedState?.flowKey ?? null,
      hasMedia: message.media != null,
      textLength: text.length
    });

    if (!loadedState || this.isSessionExpired(loadedState)) {
      if (loadedState) {
        this.logChannelDebug("conversation session expired", {
          chatId,
          phoneE164,
          userId: user.id,
          updatedAt: loadedState.updatedAt?.toISOString() ?? null
        });
        await this.deps.store.clearState(chatId);
      }

      const state = await this.createInitialState(chatId, phoneE164);
      this.logChannelDebug("conversation state created", {
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
        payload: message
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
      payload: message
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

  /**
   * Resolve o operador a partir da identidade crua do canal:
   * - phone → candidatos BR (com/sem o 9) + findUserByPhone (WhatsApp);
   * - telegram → findUserByTelegramId.
   */
  private async resolveUser(message: IncomingMessage): Promise<UserRecord | null> {
    if (message.identity.kind === "telegram") {
      return this.deps.store.findUserByTelegramId(message.identity.value);
    }

    const candidates = getWahaPhoneLookupCandidates(message.identity.value);
    for (const candidate of candidates) {
      const user = await this.deps.store.findUserByPhone(candidate);
      if (user) {
        return user;
      }
    }

    return null;
  }

  /**
   * Auto-vínculo do Telegram: casa o telefone compartilhado com um operador
   * cadastrado e grava o telegramUserId. Só vincula se o contato for do próprio
   * remetente e o operador ainda não tiver Telegram vinculado.
   */
  private async handleSharedContact(
    chatId: string,
    telegramUserId: string,
    contact: { phone: string; belongsToSender: boolean }
  ): Promise<void> {
    // Se o operador já está vinculado (mandou o contato de novo), só confirma.
    const existing = await this.deps.store.findUserByTelegramId(telegramUserId);
    if (existing) {
      await this.finishOnboarding(chatId, existing.nome);
      return;
    }

    if (!contact.belongsToSender) {
      this.logChannelDebug("shared contact rejected: not the sender's own contact", { chatId });
      await this.deps.messaging.sendText(
        chatId,
        "⚠️ Compartilhe o seu próprio contato usando o botão para vincular seu acesso."
      );
      return;
    }

    const phoneDigits = contact.phone.replace(/\D/g, "");
    const phoneCandidates = getWahaPhoneLookupCandidates(phoneDigits);

    const { user, alreadyLinked } = await this.deps.store.linkTelegramIdByPhone({
      phoneCandidates,
      telegramUserId
    });

    if (alreadyLinked) {
      // O operador (por telefone) já tinha OUTRO telegramUserId vinculado.
      this.logChannelDebug("shared contact matched a user already linked to another telegram id", {
        chatId
      });
      await this.deps.messaging.sendText(
        chatId,
        "Este cadastro ja esta vinculado a outra conta do Telegram. Fale com o administrador."
      );
      return;
    }

    if (!user) {
      this.logChannelDebug("shared contact did not match a registered user", {
        chatId,
        phoneCandidates
      });
      await this.deps.messaging.sendText(
        chatId,
        "Seu telefone nao esta cadastrado. Fale com o administrador para liberar o acesso."
      );
      return;
    }

    this.logChannelDebug("shared contact linked telegram id to user", {
      chatId,
      userId: user.id,
      telegramUserId
    });
    await this.finishOnboarding(chatId, user.nome);
  }

  private async finishOnboarding(chatId: string, userName?: string | null): Promise<void> {
    if (this.deps.channelOnboarding) {
      await this.deps.channelOnboarding.confirmContactLinked(chatId, userName);
      return;
    }
    await this.deps.messaging.sendText(chatId, "✅ Acesso vinculado! Digite *menu* para começar.");
  }

  private logChannelDebug(message: string, details: Record<string, unknown>): void {
    if (isChannelDebugLoggingEnabled()) {
      console.info(message, details);
    }
  }

  private isResetCommand(text: string): boolean {
    return RESET_COMMANDS.has(text.toLowerCase());
  }

  private isSessionExpired(state: ConversationStateRecord): boolean {
    const updatedAt = state.updatedAt;
    if (!updatedAt) {
      return false;
    }

    return Date.now() - updatedAt.getTime() > SESSION_TIMEOUT_MS;
  }
}

function isChannelDebugLoggingEnabled(): boolean {
  const value = process.env.WAHA_DEBUG_LOGS?.toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
