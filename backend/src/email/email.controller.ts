import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { EmailService } from "./email.service";
import { Public, Roles } from "../auth/auth.decorators";

@Controller("email")
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Roles("admin")
  @Get("cloudflare/status")
  status() {
    return this.emailService.getStatus();
  }

  @Public()
  @Post("cloudflare/inbound")
  receiveInbound(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-hw-timestamp") timestamp?: string,
    @Headers("x-hw-signature") signature?: string,
  ) {
    return this.emailService.receiveCloudflareEvent(
      request.body,
      request.rawBody,
      timestamp,
      signature,
    );
  }

  @Roles("admin")
  @Post("send")
  send(@Body() payload: unknown) {
    return this.emailService.sendLeadEmail(payload);
  }
}
