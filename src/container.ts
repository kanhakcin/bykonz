import type { AppConfig } from "./config/env";
import { WahaClient } from "./lib/wahaClient";
import { prisma } from "./lib/prisma";
import { S3ObjectStorage } from "./lib/s3Storage";
import { PdfReportGenerator } from "./lib/pdfGenerator";
import { ConversationService } from "./services/conversationService";
import { PrismaConversationStore } from "./services/prismaConversationStore";
import { DailyReportService } from "./services/dailyReportService";
import { PanelService } from "./services/panelService";
import { PrismaPanelStore } from "./services/prismaPanelStore";
import type { DailyReportJobDeps } from "./jobs/dailyReportJob";

export function createConversationService(config: AppConfig): ConversationService {
  const wahaClient = WahaClient.fromConfig(config);
  const objectStorage = S3ObjectStorage.fromConfig(config);
  const store = new PrismaConversationStore(prisma);
  const pdfGenerator = new PdfReportGenerator(objectStorage);

  return new ConversationService({
    store,
    messaging: wahaClient,
    mediaDownloader: wahaClient,
    objectStorage,
    pdfGenerator,
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
  return {
    dailyReportService: createDailyReportService(config),
    store: new PrismaConversationStore(prisma),
    messaging: WahaClient.fromConfig(config)
  };
}
