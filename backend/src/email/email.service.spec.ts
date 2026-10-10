import { UnauthorizedException } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { EmailService } from "./email.service";
import { LeadsService } from "../leads/leads.service";

describe("EmailService", () => {
  let leads: LeadsService;
  let service: EmailService;
  const oldSecret = process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET = "test-only-secret";
    leads = new LeadsService();
    service = new EmailService(leads);
  });

  afterEach(() => {
    if (oldSecret === undefined) {
      delete process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET;
    } else {
      process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET = oldSecret;
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
});
