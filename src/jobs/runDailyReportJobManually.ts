import { loadConfig } from "../config/env";
import { createDailyReportJobDeps } from "../container";
import { runDailyReportJob } from "./dailyReportJob";

const config = loadConfig();
const referenceDate = process.argv[2];

runDailyReportJob(createDailyReportJobDeps(config), referenceDate)
  .then(() => {
    console.log("[dailyReportJob] Execução manual concluída.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[dailyReportJob] Execução manual falhou:", error);
    process.exit(1);
  });
