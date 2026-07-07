import cron from "node-cron";
import type { AppConfig } from "../config/env";
import type { DailyReportService } from "../services/dailyReportService";
import type { ConversationStore, MessagingClient } from "../services/conversationService";

export interface DailyReportJobDeps {
  dailyReportService: DailyReportService;
  store: Pick<ConversationStore, "findObrasForAutoReport">;
  messaging: MessagingClient;
}

export async function runDailyReportJob(deps: DailyReportJobDeps, referenceDate: string = todayISOSaoPaulo()): Promise<void> {
  const obras = await deps.store.findObrasForAutoReport();

  for (const obra of obras) {
    try {
      if (!obra.whatsappGroupId) {
        console.error(
          `[dailyReportJob] Obra ${obra.id} (${obra.nome}) tem auto-report ativado mas whatsappGroupId vazio. Pulando.`
        );
        continue;
      }

      const result = await deps.dailyReportService.generateForObraDay({ obraId: obra.id, date: referenceDate });
      if (!result) {
        console.error(`[dailyReportJob] Obra ${obra.id} não encontrada ao gerar relatório.`);
        continue;
      }

      if (result.totalEntradas === 0) {
        await deps.messaging.sendText(
          obra.whatsappGroupId,
          `📋 Diário de Obra — ${obra.nome} (${formatBR(referenceDate)}): nenhum registro lançado hoje.`
        );
        continue;
      }

      await deps.messaging.sendFile(obra.whatsappGroupId, {
        mimetype: "application/pdf",
        filename: `diario-obra-${referenceDate}.pdf`,
        data: result.buffer.toString("base64")
      });
      await deps.messaging.sendText(obra.whatsappGroupId, "✅ Diário de obra gerado e enviado automaticamente.");
    } catch (error) {
      console.error(`[dailyReportJob] Falha ao processar obra ${obra.id} (${obra.nome}):`, error);
    }
  }
}

export function scheduleDailyReportJob(config: AppConfig, deps: DailyReportJobDeps): void {
  cron.schedule(
    config.dailyReportCron,
    () => {
      void runDailyReportJob(deps).catch((error) => {
        console.error("[dailyReportJob] Execução falhou:", error);
      });
    },
    { timezone: "America/Sao_Paulo" }
  );
}

function todayISOSaoPaulo(): string {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" })
    .slice(0, 10);
}

function formatBR(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}
