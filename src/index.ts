import { createApp } from "./app";
import { createPanelRouter } from "./api/panelRouter";
import { loadConfig } from "./config/env";
import { createConversationService, createPanelService, createDailyReportJobDeps } from "./container";
import { prisma } from "./lib/prisma";
import { scheduleDailyReportJob } from "./jobs/dailyReportJob";

const config = loadConfig();

scheduleDailyReportJob(config, createDailyReportJobDeps(config));

let panelRouter;
if (config.panelJwtSecret) {
  panelRouter = createPanelRouter(createPanelService(config), {
    jwtSecret: config.panelJwtSecret,
    corsOrigins: config.panelCorsOrigins
  });
} else {
  console.warn("PANEL_JWT_SECRET not set — manager panel API (/api/v1) is disabled.");
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
