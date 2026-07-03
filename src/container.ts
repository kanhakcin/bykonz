import type { AppConfig } from "./config/env";
import { WahaClient } from "./lib/wahaClient";
import { prisma } from "./lib/prisma";
import { S3ObjectStorage } from "./lib/s3Storage";
import { PdfReportGenerator } from "./lib/pdfGenerator";
import { ConversationService } from "./services/conversationService";
import { PrismaConversationStore } from "./services/prismaConversationStore";
import { PanelService } from "./services/panelService";
import { PrismaPanelStore } from "./services/prismaPanelStore";

export function createConversationService(config: AppConfig): ConversationService {
  const wahaClient = WahaClient.fromConfig(config);
  const objectStorage = S3ObjectStorage.fromConfig(config);

  return new ConversationService({
    store: new PrismaConversationStore(prisma),
    messaging: wahaClient,
    mediaDownloader: wahaClient,
    objectStorage,
    pdfGenerator: new PdfReportGenerator(objectStorage)
  });
}

export function createPanelService(config: AppConfig): PanelService {
  const objectStorage = S3ObjectStorage.fromConfig(config);

  return new PanelService(new PrismaPanelStore(prisma), {
    timezoneOffset: config.panelTimezoneOffset,
    mediaStorage: objectStorage
  });
}
