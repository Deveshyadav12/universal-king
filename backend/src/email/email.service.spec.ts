import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac } from "node:crypto";
import { createTransport } from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailService } from "./email.service";
import { LeadsService } from "../leads/leads.service";

vi.mock("nodemailer", () => ({
  createTransport: vi.fn(),
}));

describe("EmailService", () => {
  let leads: LeadsService;
  let service: EmailService;
  const originalEnv = {
    CLOUDFLARE_EMAIL_WEBHOOK_SECRET: process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET,
    BREVO_SMTP_HOST: process.env.BREVO_SMTP_HOST,
    BREVO_SMTP_PORT: process.env.BREVO_SMTP_PORT,
    BREVO_SMTP_USER: process.env.BREVO_SMTP_USER,
    BREVO_SMTP_KEY: process.env.BREVO_SMTP_KEY,
    BREVO_FROM_EMAIL: process.env.BREVO_FROM_EMAIL,
    BREVO_FROM_NAME: process.env.BREVO_FROM_NAME,
  };

  beforeEach(() => {
    process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET = "test-only-secret";
    process.env.BREVO_SMTP_HOST = "smtp-relay.brevo.com";
    process.env.BREVO_SMTP_PORT = "587";
    process.env.BREVO_SMTP_USER = "smtp-user";
    process.env.BREVO_SMTP_KEY = "test-only-smtp-key";
    process.env.BREVO_FROM_EMAIL = "sales@hexawave.example";
    process.env.BREVO_FROM_NAME = "HexaWave";
    vi.resetAllMocks();
    leads = new LeadsService();
    service = new EmailService(leads);
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("authenticates a fresh Cloudflare event and updates its lead", () => {
    const lead = leads.create({
      companyName: "Northstar",
      email: "reply@northstar.example",
    });
    leads.update(lead.id, { status: "QUALIFIED" });
    leads.update(lead.id, { status: "READY_TO_CONTACT" });
    leads.update(lead.id, { status: "CONTACTED" });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ type: "reply", email: lead.email });
    const rawBody = Buffer.from(body);
    const signature = createHmac("sha256", "test-only-secret")
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest("hex");

    expect(
      service.receiveCloudflareEvent(
        JSON.parse(body),
        rawBody,
        timestamp,
        signature,
      ),
    ).toMatchObject({ leadToken: lead.leadToken, status: "REPLIED", applied: true });
  });

  it("rejects invalid signatures and stale requests", () => {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = Buffer.from('{"type":"reply","email":"x@example.com"}');
    const payload = JSON.parse(rawBody.toString());

    expect(() =>
      service.receiveCloudflareEvent(payload, rawBody, timestamp, "0".repeat(64)),
    ).toThrow(UnauthorizedException);
    expect(() =>
      service.receiveCloudflareEvent(
        payload,
        rawBody,
        String(Number(timestamp) - 600),
        "0".repeat(64),
      ),
    ).toThrow(UnauthorizedException);
  });

  it("sends a manually composed email and records successful contact", async () => {
    const lead = leads.create({
      companyName: "Northstar",
      email: "reply@northstar.example",
    });
    leads.update(lead.id, { status: "QUALIFIED" });
    leads.update(lead.id, { status: "READY_TO_CONTACT" });
    const sendMail = vi.fn().mockResolvedValue({ messageId: "smtp-message-id" });
    vi.mocked(createTransport).mockReturnValue({ sendMail } as never);
    expect(service.getStatus().outboundConfigured).toBe(true);

    await expect(
      service.sendLeadEmail({
        leadId: lead.id,
        subject: "A question for Northstar",
        text: "Hello, would you be open to a short conversation?",
      }),
    ).resolves.toMatchObject({
      success: true,
      messageId: "smtp-message-id",
      lead: { status: "CONTACTED", lastContactedAt: expect.any(String) },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: lead.email,
        subject: "A question for Northstar",
        text: "Hello, would you be open to a short conversation?",
      }),
    );
    expect(leads.audit(1)[0]).toMatchObject({ action: "OUTBOUND_EMAIL_SENT" });
  });

  it("does not send to a suppressed lead or accept an invalid subject", async () => {
    const lead = leads.create({
      companyName: "Northstar",
      email: "reply@northstar.example",
    });
    leads.suppress(lead.id, "manual test");

    await expect(
      service.sendLeadEmail({
        leadId: lead.id,
        subject: "Hello",
        text: "Message",
      }),
    ).rejects.toThrow(BadRequestException);
    expect(createTransport).not.toHaveBeenCalled();

    await expect(
      service.sendLeadEmail({
        leadId: lead.id,
        subject: "Hello\r\nBcc: attacker@example.com",
        text: "Message",
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it("reports missing SMTP configuration and does not update a lead when delivery fails", async () => {
    delete process.env.BREVO_SMTP_KEY;
    expect(service.getStatus().outboundConfigured).toBe(false);
    await expect(
      service.sendLeadEmail({ leadId: "missing", subject: "Hello", text: "Message" }),
    ).rejects.toThrow(ServiceUnavailableException);

    process.env.BREVO_SMTP_KEY = "test-only-smtp-key";
    const lead = leads.create({
      companyName: "Northstar",
      email: "reply@northstar.example",
    });
    leads.update(lead.id, { status: "QUALIFIED" });
    leads.update(lead.id, { status: "READY_TO_CONTACT" });
    const sendMail = vi.fn().mockRejectedValue(new Error("SMTP unavailable"));
    vi.mocked(createTransport).mockReturnValue({ sendMail } as never);

    await expect(
      service.sendLeadEmail({ leadId: lead.id, subject: "Hello", text: "Message" }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(leads.get(lead.id)).toMatchObject({
      status: "READY_TO_CONTACT",
      lastContactedAt: null,
    });
  });
});
