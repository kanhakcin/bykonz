import type { AppConfig } from "./config/env";
import { WahaClient } from "./lib/wahaClient";
import { TelegramClient } from "./lib/telegramClient";
import { ChannelRouterClient } from "./lib/channelRouterClient";
import { TelegramOnboardingClient } from "./lib/telegramOnboarding";
import type { ChannelOnboarding, MediaDownloader, MessagingClient } from "./services/conversationService";
import { prisma } from "./lib/prisma";
import { S3ObjectStorage } from "./lib/s3Storage";
import { PdfReportGenerator } from "./lib/pdfGenerator";
import { ConversationService } from "./services/conversationService";
import { PrismaConversationStore } from "./services/prismaConversationStore";
import { DailyReportService } from "./services/dailyReportService";
import { PanelService } from "./services/panelService";
import { PrismaPanelStore } from "./services/prismaPanelStore";
import type { DailyReportJobDeps } from "./jobs/dailyReportJob";

/**
 * Monta o cliente de mensageria roteado: instancia os dois clientes disponíveis
 * (WAHA se as vars WAHA existem; Telegram se o token existe) atrás de um
 * ChannelRouterClient que despacha pelo prefixo do chatId/ref (§9 do plano).
 * Expõe também o TelegramClient bruto, necessário para o onboarding.
 */
function createRoutedMessaging(config: AppConfig): {
  messaging: MessagingClient & MediaDownloader;
  onboarding: ChannelOnboarding | undefined;
} {
  const waha = config.wahaBaseUrl ? WahaClient.fromConfig(config) : null;
  const telegram = config.telegramBotToken ? TelegramClient.fromConfig(config) : null;
  return {
    messaging: new ChannelRouterClient({ waha, telegram }),
    onboarding: telegram ? new TelegramOnboardingClient(telegram) : undefined
  };
}

export function createConversationService(config: AppConfig): ConversationService {
  const { messaging, onboarding } = createRoutedMessaging(config);
  const objectStorage = S3ObjectStorage.fromConfig(config);
  const store = new PrismaConversationStore(prisma);
  const pdfGenerator = new PdfReportGenerator(objectStorage);

  return new ConversationService({
    store,
    messaging,
    mediaDownloader: messaging,
    objectStorage,
    pdfGenerator,
    channelOnboarding: onboarding,
    // Mesmo gerador do painel: o menu "Gerar diario de obra" envia o PDF
    // idêntico ao baixado em /relatorios.
    dailyReport: new DailyReportService(store, pdfGenerator, {
      timezoneOffset: config.panelTimezoneOffset
    })
  });
}

export function createDailyReportService(config: AppConfig): DailyReportService {
  const objectStorage = S3ObjectStorage.fromConfig(config);

  return new DailyReportService(new PrismaConversationStore(prisma), new PdfReportGenerator(objectStorage), {
    timezoneOffset: config.panelTimezoneOffset
  });
}

export function createPanelService(config: AppConfig): PanelService {
  const objectStorage = S3ObjectStorage.fromConfig(config);

  return new PanelService(new PrismaPanelStore(prisma), {
    timezoneOffset: config.panelTimezoneOffset,
    mediaStorage: objectStorage,
    dailyReportService: createDailyReportService(config)
  });
}

export function createDailyReportJobDeps(config: AppConfig): DailyReportJobDeps {
  // Auto-report continua WhatsApp-only (grupos são fase futura). O router
  // despacha os group JIDs (sem prefixo `tg:`) para o WahaClient; se WAHA não
  // estiver configurado e houver obra com auto-report, o envio falha de forma
  // explícita — comportamento aceitável para v1.
  return {
    dailyReportService: createDailyReportService(config),
    store: new PrismaConversationStore(prisma),
    messaging: createRoutedMessaging(config).messaging
  };
}
