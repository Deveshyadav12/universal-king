import {
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

@Controller("email/cloudflare")
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Roles("admin")
  @Get("status")
  status() {
    return this.emailService.getStatus();
  }

  @Public()
  @Post("inbound")
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
}
