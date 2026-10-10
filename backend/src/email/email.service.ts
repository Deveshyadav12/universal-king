import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { LeadsService } from "../leads/leads.service";

const MAX_TIMESTAMP_SKEW_SECONDS = 300;

@Injectable()
export class EmailService {
  constructor(private readonly leadsService: LeadsService) {}

  getStatus() {
    return {
      inboundConfigured: Boolean(process.env.CLOUDFLARE_EMAIL_WEBHOOK_SECRET),
      outboundConfigured: false,
    };
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
}
