import cron from "node-cron";
import type { AppConfig } from "../config/env";
import type { DailyReportResult, DailyReportService } from "../services/dailyReportService";
import type { ConversationStore, Mailer, MessagingClient, ObraForReport } from "../services/conversationService";
import { renderEmailHtml, renderEmailText } from "../lib/emailTemplate";

export interface DailyReportJobDeps {
  dailyReportService: DailyReportService;
  store: Pick<ConversationStore, "findObrasForAutoReport">;
  messaging: MessagingClient;
  /** Canal de e-mail (opcional). Null quando o SMTP não está configurado. */
  mailer?: Mailer | null;
}

export async function runDailyReportJob(deps: DailyReportJobDeps, referenceDate: string = todayISOSaoPaulo()): Promise<void> {
  const obras = await deps.store.findObrasForAutoReport();

  for (const obra of obras) {
    try {
      const result = await deps.dailyReportService.generateForObraDay({ obraId: obra.id, date: referenceDate });
      if (!result) {
        console.error(`[dailyReportJob] Obra ${obra.id} não encontrada ao gerar relatório.`);
        continue;
      }

      // Canais independentes: WhatsApp e e-mail são disparados separadamente,
      // cada um com seu próprio tratamento de erro, para que a falha de um não
      // impeça o outro nem interrompa o loop das demais obras.
      await sendWhatsapp(deps, obra, result, referenceDate);
      await sendEmail(deps, obra, result, referenceDate);
    } catch (error) {
      console.error(`[dailyReportJob] Falha ao processar obra ${obra.id} (${obra.nome}):`, error);
    }
  }
}

async function sendWhatsapp(
  deps: DailyReportJobDeps,
  obra: ObraForReport,
  result: DailyReportResult,
  referenceDate: string
): Promise<void> {
  if (!obra.whatsappAutoReportEnabled) {
    return;
  }
  if (!obra.whatsappGroupId) {
    console.error(
      `[dailyReportJob] Obra ${obra.id} (${obra.nome}) tem auto-report de WhatsApp ativado mas whatsappGroupId vazio. Pulando WhatsApp.`
    );
    return;
  }

  try {
    if (result.totalEntradas === 0) {
      await deps.messaging.sendText(
        obra.whatsappGroupId,
        `📋 Diário de Obra — ${obra.nome} (${formatBR(referenceDate)}): nenhum registro lançado hoje.`
      );
      return;
    }

    await deps.messaging.sendFile(obra.whatsappGroupId, {
      mimetype: "application/pdf",
      filename: result.filename ?? `diario-obra-${referenceDate}.pdf`,
      data: result.buffer.toString("base64")
    });
    await deps.messaging.sendText(obra.whatsappGroupId, "✅ Diário de obra gerado e enviado automaticamente.");
  } catch (error) {
    console.error(`[dailyReportJob] Falha ao enviar WhatsApp da obra ${obra.id} (${obra.nome}):`, error);
  }
}

async function sendEmail(
  deps: DailyReportJobDeps,
  obra: ObraForReport,
  result: DailyReportResult,
  referenceDate: string
): Promise<void> {
  if (!obra.emailAutoReportEnabled) {
    return;
  }
  // Dia sem registros não gera e-mail (evita encher a caixa).
  if (result.totalEntradas === 0) {
    return;
  }
  if (obra.reportEmailRecipients.length === 0) {
    console.error(
      `[dailyReportJob] Obra ${obra.id} (${obra.nome}) tem auto-report de e-mail ativado mas sem destinatários. Pulando e-mail.`
    );
    return;
  }
  if (!deps.mailer) {
    console.error(
      `[dailyReportJob] Obra ${obra.id} (${obra.nome}) pede e-mail mas o SMTP não está configurado. Pulando e-mail.`
    );
    return;
  }

  try {
    const dataBR = formatBR(referenceDate);
    const filename = result.filename ?? `diario-obra-${referenceDate}.pdf`;
    const template = {
      heading: `${obra.nome} — ${dataBR}`,
      paragraphs: [`Segue em anexo o Diário de Obra de ${obra.nome} referente a ${dataBR}.`],
      note: `Anexo: ${filename}`
    };
    await deps.mailer.sendMail({
      to: obra.reportEmailRecipients,
      subject: `Diário de Obra — ${obra.nome} (${dataBR})`,
      text: renderEmailText(template),
      html: renderEmailHtml(template),
      attachments: [{ filename, content: result.buffer, contentType: "application/pdf" }]
    });
  } catch (error) {
    console.error(`[dailyReportJob] Falha ao enviar e-mail da obra ${obra.id} (${obra.nome}):`, error);
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
