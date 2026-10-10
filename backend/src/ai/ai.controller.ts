import {
  Body,
  Get,
  Controller,
  Post,
  Res,
} from "@nestjs/common";

import { Response } from "express";

import { AiService } from "./ai.service";
import { CurrentUser, Public } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../users/users.service";
import { BillingService } from "../billing/billing.service";

@Controller("ai")
export class AiController {

  constructor(
    private readonly aiService: AiService,
    private readonly billingService: BillingService,
  ) {}

  @Public()
  @Get("health")
  getHealth() {
    return this.aiService.getHealth();
  }


  @Post("generate")
  generate(
    @Body()
    body: {
      projectName: string;
      projectType: string;
      stack: string;
      prompt: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billingService.executeAiAction(user.id, () =>
      this.aiService.generate(body),
    );
  }


  @Post("generate/zip")
  async generateZip(
    @Body()
    body: {
      projectName: string;
      projectType: string;
      stack: string;
      prompt: string;
    },
    @Res() response: Response,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result = await this.billingService.executeAiAction(user.id, () =>
      this.aiService.generateZip(body),
    );

    response.setHeader(
      "Content-Type",
      "application/zip",
    );

    response.setHeader(
      "Content-Disposition",
      result.contentDisposition ||
        'attachment; filename="hexawave-project.zip"',
    );

    response.send(result.buffer);
  }


  @Post("preview")
  async preview(
    @Body()
    body: {
      projectName: string;
      projectType: string;
      stack: string;
      prompt: string;
    },
    @Res() response: Response,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const html = await this.billingService.executeAiAction(user.id, () =>
      this.aiService.preview(body),
    );

    response.setHeader(
      "Content-Type",
      "text/html; charset=utf-8",
    );

    response.send(html);
  }
}
