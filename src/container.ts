import type { AppConfig } from "./config/env";
import { WahaClient } from "./lib/wahaClient";
import { prisma } from "./lib/prisma";
import { SupabaseObjectStorage } from "./lib/supabaseStorage";
import { ConversationService } from "./services/conversationService";
import { PrismaConversationStore } from "./services/prismaConversationStore";

export function createConversationService(config: AppConfig): ConversationService {
  const wahaClient = WahaClient.fromConfig(config);

  return new ConversationService({
    store: new PrismaConversationStore(prisma),
    messaging: wahaClient,
    mediaDownloader: wahaClient,
    objectStorage: SupabaseObjectStorage.fromConfig(config)
  });
}
