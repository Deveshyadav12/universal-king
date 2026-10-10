import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { CurrentUser, Roles } from "../auth/auth.decorators";
import type { AuthenticatedUser } from "../users/users.service";
import { KingService, type CreateSoftwareRequestInput } from "./king.service";

@Controller("king")
export class KingController {
  constructor(private readonly kingService: KingService) {}

  @Roles("admin")
  @Get("catalog")
  catalog() {
    return this.kingService.catalog();
  }

  @Get("requests")
  listRequests(@CurrentUser() user: AuthenticatedUser) {
    return this.kingService.listRequests(
      user.role === "admin" ? undefined : (user.workspaceId ?? user.id),
    );
  }

  @Roles("admin")
  @Post("requests")
  createRequest(
    @Body() body: CreateSoftwareRequestInput,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kingService.createRequest(
      {
        ...body,
        ...(user.accountType === "company" && user.companyName
          ? { companyName: user.companyName }
          : {}),
      },
      { id: user.workspaceId ?? user.id, email: user.email },
    );
  }

  @Roles("admin")
  @Patch("requests/:id/approve")
  async approve(
    @Param("id") id: string,
    @Body() body: { note?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kingService.decide(id, "approved", user, body?.note);
  }

  @Roles("admin")
  @Patch("requests/:id/reject")
  async reject(
    @Param("id") id: string,
    @Body() body: { note?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.kingService.decide(id, "rejected", user, body?.note);
  }

  @Roles("admin")
  @Post("requests/:id/generate")
  retryGeneration(@Param("id") id: string) {
    return this.kingService.retryGeneration(id);
  }
}
