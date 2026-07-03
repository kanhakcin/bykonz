import { createApp } from "./app";
import { createPanelRouter } from "./api/panelRouter";
import { loadConfig } from "./config/env";
import { createConversationService, createPanelService } from "./container";
import { prisma } from "./lib/prisma";

const config = loadConfig();

let panelRouter;
if (config.panelApiToken) {
  panelRouter = createPanelRouter(createPanelService(config), {
    token: config.panelApiToken,
    corsOrigins: config.panelCorsOrigins,
    user: { name: config.panelUserName, role: config.panelUserRole }
  });
} else {
  console.warn("PANEL_API_TOKEN not set — manager panel API (/api/v1) is disabled.");
}

const app = createApp(createConversationService(config), config.webhookSecret, { panelRouter });
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
