import nodemailer, { type Transporter } from "nodemailer";
import type { AppConfig } from "../config/env";
import type { Mailer, MailAttachment } from "../services/conversationService";

/**
 * Cliente de e-mail (SMTP) via nodemailer, implementando a porta `Mailer`.
 * Injetado no job de auto-report para enviar o Diário de Obra por e-mail.
 */
export class MailClient implements Mailer {
  constructor(
    private readonly transporter: Transporter,
    private readonly from: string
  ) {}

  /**
   * Cria o cliente a partir da config. Retorna `null` se o SMTP não estiver
   * configurado (SMTP_HOST + SMTP_FROM ausentes) — o canal de e-mail fica
   * desligado sem quebrar o resto do sistema, espelhando o padrão de canais
   * opcionais (WAHA/Telegram).
   */
  static fromConfig(config: AppConfig): MailClient | null {
    if (!config.smtpHost || !config.smtpFrom) {
      return null;
    }

    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPass ?? "" } : undefined
    });

    return new MailClient(transporter, config.smtpFrom);
  }

  async sendMail(input: {
    to: string[];
    subject: string;
    text: string;
    html?: string;
    attachments?: MailAttachment[];
  }): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType
      }))
    });
  }
}
