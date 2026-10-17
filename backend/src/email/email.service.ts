import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createTransport } from "nodemailer";
import { LeadsService } from "../leads/leads.service";

const MAX_TIMESTAMP_SKEW_SECONDS = 300;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SmtpConfiguration {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly leadsService: LeadsService) {}

  getStatus() {
    return {
      inboundConfigured: Boolean(process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET),
      outboundConfigured: this.getSmtpConfiguration() !== null,
    };
  }

  async sendLeadEmail(payload: unknown) {
    if (
      typeof payload !== "object" ||
      payload === null ||
      Array.isArray(payload) ||
      !("leadId" in payload) ||
      !("subject" in payload) ||
      !("text" in payload)
    ) {
      throw new BadRequestException("Email payload must include leadId, subject, and text.");
    }

    const { leadId, subject, text } = payload;
    if (typeof leadId !== "string" || !leadId.trim() || leadId.length > 100) {
      throw new BadRequestException("A valid leadId is required.");
    }
    if (
      typeof subject !== "string" ||
      !subject.trim() ||
      subject.trim().length > 200 ||
      /[\r\n]/.test(subject)
    ) {
      throw new BadRequestException("Subject must be 1-200 characters without line breaks.");
    }
    if (typeof text !== "string" || !text.trim() || text.length > 10_000) {
      throw new BadRequestException("Email text must be 1-10000 characters.");
    }

    const config = this.getSmtpConfiguration();
    if (!config) {
      throw new ServiceUnavailableException(
        "Outbound email is not configured. Set the BREVO_SMTP_USER, BREVO_SMTP_KEY, and BREVO_FROM_EMAIL backend variables.",
      );
    }

    const lead = this.leadsService.get(leadId.trim());
    if (!lead.email || !EMAIL_PATTERN.test(lead.email)) {
      throw new BadRequestException("This lead does not have a valid email address.");
    }
    if (lead.status !== "READY_TO_CONTACT" && lead.status !== "FOLLOW_UP") {
      throw new BadRequestException(
        "Email can only be sent to leads with READY_TO_CONTACT or FOLLOW_UP status.",
      );
    }

    const transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.password },
    });
    let messageId: string;
    try {
      const result = await transporter.sendMail({
        from: { name: config.fromName, address: config.fromEmail },
        to: lead.email,
        subject: subject.trim(),
        text: text.trim(),
      });
      messageId = result.messageId;
    } catch (error: unknown) {
      this.logger.error(
        "Brevo SMTP could not send the CRM email.",
        error instanceof Error ? error.name : "Unknown SMTP error",
      );
      throw new ServiceUnavailableException("Brevo SMTP could not send the email.");
    }
    const updatedLead = this.leadsService.recordOutboundEmailSent(lead.id);
    return { success: true, messageId, lead: updatedLead };
  }

  receiveCloudflareEvent(
    payload: unknown,
    rawBody: Buffer | undefined,
    timestamp: string | undefined,
    signature: string | undefined,
  ) {
    const secret = process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException(
        "Inbound email is not configured: CLOUDFLARE_EMAIL_WEBHOOK_SECRET is missing.",
      );
    }
    if (!rawBody || !timestamp || !signature || !/^\d{10}$/.test(timestamp)) {
      throw new UnauthorizedException("Missing or malformed webhook authentication.");
    }

    const timestampSeconds = Number(timestamp);
    if (Math.abs(Date.now() / 1000 - timestampSeconds) > MAX_TIMESTAMP_SKEW_SECONDS) {
      throw new UnauthorizedException("Webhook timestamp is outside the allowed time window.");
    }

    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest();
    if (!/^[a-f\d]{64}$/i.test(signature)) {
      throw new UnauthorizedException("Invalid webhook signature.");
    }
    const supplied = Buffer.from(signature, "hex");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException("Invalid webhook signature.");
    }

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("type" in payload) ||
      !("email" in payload)
    ) {
      throw new BadRequestException("Webhook payload must include type and email.");
    }
    const eventType = payload.type;
    const email = payload.email;
    if (
      typeof eventType !== "string" ||
      !["reply", "unsubscribe", "bounce"].includes(eventType) ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new BadRequestException("Webhook event type or sender email is invalid.");
    }

    return this.leadsService.applyInboundEvent(
      email,
      eventType as "reply" | "unsubscribe" | "bounce",
    );
  }
  private getSmtpConfiguration(): SmtpConfiguration | null {
    const host =
      process.env.BREVO_SMTP_HOST?.trim() ||
      process.env.EMAIL_SMTP_HOST?.trim() ||
      "smtp-relay.brevo.com";

    const portValue =
      process.env.BREVO_SMTP_PORT?.trim() ||
      process.env.EMAIL_SMTP_PORT?.trim() ||
      "587";

    const port = Number(portValue);

    const user =
      process.env.BREVO_SMTP_USER?.trim() ||
      process.env.EMAIL_SMTP_USER?.trim();

    const password =
      process.env.BREVO_SMTP_KEY?.trim() ||
      process.env.BREVO_SMTP_PASS?.trim() ||
      process.env.EMAIL_SMTP_PASS?.trim();

    const fromEmail =
      process.env.BREVO_FROM_EMAIL?.trim() ||
      process.env.EMAIL_FROM?.trim();

    const fromName =
      process.env.BREVO_FROM_NAME?.trim() || "Universal King";

    if (
      !user ||
      !password ||
      !fromEmail ||
      !EMAIL_PATTERN.test(fromEmail) ||
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535
    ) {
      return null;
    }

    return { host, port, user, password, fromEmail, fromName };
  }
}
