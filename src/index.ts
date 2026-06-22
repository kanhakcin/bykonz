import { createApp } from "./app";
import { loadConfig } from "./config/env";
import { createConversationService } from "./container";
import { prisma } from "./lib/prisma";

const config = loadConfig();
const app = createApp(createConversationService(config));
const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${config.port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Shutting down.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
