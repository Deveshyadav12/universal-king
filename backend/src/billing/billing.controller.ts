import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Put,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser, Public, Roles } from '../auth/auth.decorators';
import { KingService } from '../king/king.service';
import type { AuthenticatedUser } from '../users/users.service';
import { BillingService, type BillingPlanId } from './billing.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${name} is required.`);
  }
  return value;
}

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly kingService: KingService,
  ) {}

  @Public()
  @Get('catalog')
  catalog() {
    return this.billingService.publicCatalog();
  }

  @Roles('admin')
  @Get('admin/config')
  adminConfiguration() {
    return this.billingService.adminConfiguration();
  }

  @Roles('admin')
  @Put('admin/config')
  updateConfiguration(@Body() body: unknown) {
    return this.billingService.updateConfiguration(body);
  }

  @Get('account')
  account(@CurrentUser() user: AuthenticatedUser) {
    return this.billingService.account(user.id);
  }

  @Post('checkout/subscription')
  createSubscription(@Body() input: unknown, @CurrentUser() user: AuthenticatedUser) {
    if (!isRecord(input)) throw new BadRequestException('Subscription checkout data is invalid.');
    const planId = input.planId;
    if (planId !== 'pro' && planId !== 'team' && planId !== 'enterprise') {
      throw new BadRequestException('A valid subscription plan is required.');
    }
    return this.billingService.createSubscriptionCheckout(
      user.id,
      planId as BillingPlanId,
      requiredString(input.idempotencyKey, 'idempotencyKey'),
    );
  }

  @Post('checkout/credits')
  createCreditsCheckout(@Body() input: unknown, @CurrentUser() user: AuthenticatedUser) {
    if (!isRecord(input)) throw new BadRequestException('AI credit checkout data is invalid.');
    return this.billingService.createCreditsCheckout(
      user.id,
      requiredString(input.packId, 'packId'),
      requiredString(input.idempotencyKey, 'idempotencyKey'),
    );
  }

  @Post('checkout/software-request')
  createSoftwareRequestCheckout(
    @Body() input: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!isRecord(input)) throw new BadRequestException('Software request checkout data is invalid.');
    return this.billingService.createSoftwareRequestCheckout(
      user,
      input.request,
      requiredString(input.idempotencyKey, 'idempotencyKey'),
    );
  }

  @Post('checkout/verify')
  async verifyCheckout(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.billingService.verifyCheckout(user.id, body);
    if (result.kind === 'software-request') {
      const request = await this.fulfillSoftwareRequest(result.paymentIntentId);
      return { ...result, request };
    }
    return result;
  }

  @Public()
  @Post('webhook')
  async webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
  ) {
    const result = await this.billingService.handleWebhook(request.rawBody, signature);
    if ('fulfilledPaymentId' in result && result.fulfilledPaymentId) {
      await this.fulfillSoftwareRequest(result.fulfilledPaymentId);
    }
    if (
      'refundPaymentId' in result &&
      result.refundPaymentId &&
      (result.refundState === 'refunded' ||
        result.refundState === 'pending' ||
        result.refundState === 'failed')
    ) {
      this.kingService.updateRefundStatusByPayment(
        result.refundPaymentId,
        result.refundState,
      );
    }
    if ('eventId' in result && typeof result.eventId === 'string') {
      this.billingService.completeWebhook(result.eventId);
    }
    return result;
  }

  private async fulfillSoftwareRequest(paymentId: string) {
    const fulfillment = this.billingService.softwareRequestForFulfillment(paymentId);
    if (!fulfillment) return null;
    const request = this.kingService.createPaidRequest(
      {
        companyName: fulfillment.request.companyName,
        productName: fulfillment.request.productName,
        languages: fulfillment.request.languages,
        purpose: fulfillment.request.purpose,
      },
      {
        id: fulfillment.request.requesterWorkspaceId,
        email: fulfillment.request.requesterEmail,
      },
      paymentId,
    );
    this.billingService.markSoftwareRequestFulfilled(paymentId, request.id);
    return request;
  }
}
