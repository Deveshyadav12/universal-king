import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { KING_LANGUAGES } from '../king/king.catalog';

export type BillingPlanId = 'pro' | 'team' | 'enterprise';
export type BillingInterval = 'monthly' | 'yearly';
export type BillingPaymentKind = 'subscription' | 'software-request' | 'credits';
export type BillingRefundState = 'processing' | 'pending' | 'refunded' | 'failed';

export interface BillingPlan {
  enabled: boolean;
  amountPaise: number | null;
  interval: BillingInterval;
  razorpayPlanId: string;
}

export interface CreditPack {
  id: string;
  label: string;
  credits: number;
  amountPaise: number;
}

export interface BillingConfiguration {
  checkoutEnabled: boolean;
  softwareRequestAmountPaise: number | null;
  creditsPerAiAction: number;
  plans: Record<BillingPlanId, BillingPlan>;
  creditPacks: CreditPack[];
}

export interface SoftwareRequestDetails {
  companyName: string;
  productName: string;
  languages: string[];
  purpose: string;
  requesterWorkspaceId: string;
  requesterEmail: string;
}

interface StoredPayment {
  id: string;
  userId: string;
  idempotencyKey: string;
  kind: BillingPaymentKind;
  amountPaise: number;
  currency: 'INR';
  status: 'creating' | 'pending' | 'paid' | 'failed' | 'refund_pending' | 'refunded';
  planId?: BillingPlanId;
  creditPackId?: string;
  credits?: number;
  softwareRequest?: SoftwareRequestDetails;
  providerOrderId?: string;
  providerSubscriptionId?: string;
  providerPaymentId?: string;
  requestId?: string;
  refundId?: string;
  refundState?: BillingRefundState;
  createdAt: string;
  paidAt?: string;
}

interface CreditLedgerEntry {
  id: string;
  userId: string;
  reason: 'purchase' | 'ai-action';
  referenceId: string;
  status: 'reserved' | 'credited' | 'charged' | 'released';
  delta: number;
  createdAt: string;
}

interface BillingStore {
  config: BillingConfiguration;
  payments: StoredPayment[];
  creditLedger: CreditLedgerEntry[];
  webhookEventIds: string[];
}

interface ProviderCredentials {
  keyId: string;
  keySecret: string;
}

interface ProviderPayment {
  id: string;
  order_id?: string;
  subscription_id?: string;
  amount: number;
  currency: string;
  status: string;
}

const DEFAULT_CONFIG: BillingConfiguration = {
  checkoutEnabled: false,
  softwareRequestAmountPaise: null,
  creditsPerAiAction: 0,
  plans: {
    pro: { enabled: false, amountPaise: null, interval: 'monthly', razorpayPlanId: '' },
    team: { enabled: false, amountPaise: null, interval: 'monthly', razorpayPlanId: '' },
    enterprise: { enabled: false, amountPaise: null, interval: 'monthly', razorpayPlanId: '' },
  },
  creditPacks: [],
};

const MAX_CREDIT_PACKS = 10;
const MAX_WEBHOOK_EVENTS = 500;
const RAZORPAY_API = 'https://api.razorpay.com/v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeInteger(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}

@Injectable()
export class BillingService {
  private store: BillingStore = {
    config: structuredClone(DEFAULT_CONFIG),
    payments: [],
    creditLedger: [],
    webhookEventIds: [],
  };
  private readonly storePath = resolve(
    process.env.HEXAWAVE_BILLING_STORE ?? 'data/billing.json',
  );

  constructor() {
    this.load();
    let recoveredReservation = false;
    for (const entry of this.store.creditLedger) {
      if (entry.status === 'reserved') {
        entry.status = 'released';
        recoveredReservation = true;
      }
    }
    if (recoveredReservation) this.persist();
  }

  publicCatalog() {
    const ready =
      this.isProviderConfigured() &&
      Boolean(process.env.HEXAWAVE_RAZORPAY_WEBHOOK_SECRET) &&
      this.store.config.checkoutEnabled;
    const config = this.store.config;
    return {
      checkoutAvailable: ready,
      softwareRequest:
        ready && isSafeInteger(config.softwareRequestAmountPaise, 1)
          ? { amountPaise: config.softwareRequestAmountPaise, currency: 'INR' as const }
          : null,
      plans: (Object.entries(config.plans) as [BillingPlanId, BillingPlan][]).map(
        ([id, plan]) => ({
          id,
          enabled:
            ready &&
            plan.enabled &&
            isSafeInteger(plan.amountPaise, 1) &&
            Boolean(plan.razorpayPlanId),
          amountPaise: plan.amountPaise,
          interval: plan.interval,
        }),
      ),
      creditPacks: ready
        ? config.creditPacks.map(({ id, label, credits, amountPaise }) => ({
            id,
            label,
            credits,
            amountPaise,
            currency: 'INR' as const,
          }))
        : [],
    };
  }

  adminConfiguration() {
    const credentials = this.readCredentials();
    return {
      ...structuredClone(this.store.config),
      provider: {
        credentialsConfigured: Boolean(credentials),
        webhookConfigured: Boolean(process.env.HEXAWAVE_RAZORPAY_WEBHOOK_SECRET),
        mode: credentials?.keyId.startsWith('rzp_live_')
          ? 'live'
          : credentials?.keyId.startsWith('rzp_test_')
            ? 'test'
            : 'unconfigured',
        livePaymentsEnabled: process.env.HEXAWAVE_RAZORPAY_LIVE_ENABLED === 'true',
        productionCheckoutSupported: false,
      },
    };
  }

  updateConfiguration(input: unknown): ReturnType<BillingService['adminConfiguration']> {
    if (!isRecord(input)) throw new BadRequestException('Billing configuration must be an object.');
    if (typeof input.checkoutEnabled !== 'boolean') {
      throw new BadRequestException('checkoutEnabled must be a boolean.');
    }
    if (
      input.softwareRequestAmountPaise !== null &&
      !isSafeInteger(input.softwareRequestAmountPaise, 1)
    ) {
      throw new BadRequestException('Software request fee must be a positive amount in paise or null.');
    }
    if (!isSafeInteger(input.creditsPerAiAction, 0) || input.creditsPerAiAction > 100_000) {
      throw new BadRequestException('creditsPerAiAction must be an integer from 0 to 100000.');
    }
    if (!isRecord(input.plans)) throw new BadRequestException('plans must be an object.');

    const planIds: BillingPlanId[] = ['pro', 'team', 'enterprise'];
    const plans = {} as Record<BillingPlanId, BillingPlan>;
    for (const id of planIds) {
      const value = input.plans[id];
      if (!isRecord(value) || typeof value.enabled !== 'boolean') {
        throw new BadRequestException(`The ${id} plan configuration is invalid.`);
      }
      if (value.amountPaise !== null && !isSafeInteger(value.amountPaise, 1)) {
        throw new BadRequestException(`${id} amount must be a positive amount in paise or null.`);
      }
      if (value.interval !== 'monthly' && value.interval !== 'yearly') {
        throw new BadRequestException(`${id} interval must be monthly or yearly.`);
      }
      if (
        typeof value.razorpayPlanId !== 'string' ||
        value.razorpayPlanId.length > 100 ||
        (value.razorpayPlanId !== '' && !/^plan_[A-Za-z0-9]+$/.test(value.razorpayPlanId))
      ) {
        throw new BadRequestException(`${id} Razorpay plan ID is invalid.`);
      }
      if (value.enabled && (!isSafeInteger(value.amountPaise, 1) || !value.razorpayPlanId)) {
        throw new BadRequestException(`Configure both a price and a Razorpay plan ID before enabling ${id}.`);
      }
      plans[id] = {
        enabled: value.enabled,
        amountPaise: value.amountPaise,
        interval: value.interval,
        razorpayPlanId: value.razorpayPlanId.trim(),
      };
    }

    if (!Array.isArray(input.creditPacks) || input.creditPacks.length > MAX_CREDIT_PACKS) {
      throw new BadRequestException(`creditPacks must contain at most ${MAX_CREDIT_PACKS} entries.`);
    }
    const seenPackIds = new Set<string>();
    const creditPacks: CreditPack[] = input.creditPacks.map((value) => {
      if (
        !isRecord(value) ||
        typeof value.id !== 'string' ||
        !/^[a-z0-9][a-z0-9-]{0,39}$/.test(value.id) ||
        seenPackIds.has(value.id) ||
        typeof value.label !== 'string' ||
        value.label.trim().length < 1 ||
        value.label.trim().length > 80 ||
        !isSafeInteger(value.credits, 1) ||
        value.credits > 1_000_000 ||
        !isSafeInteger(value.amountPaise, 1)
      ) {
        throw new BadRequestException('Each credit pack needs a unique ID, label, positive credit count, and price.');
      }
      seenPackIds.add(value.id);
      return {
        id: value.id,
        label: value.label.trim(),
        credits: value.credits,
        amountPaise: value.amountPaise,
      };
    });
    if (
      input.checkoutEnabled &&
      creditPacks.length > 0 &&
      input.creditsPerAiAction === 0
    ) {
      throw new BadRequestException(
        'Set creditsPerAiAction to at least 1 before selling AI credit packs.',
      );
    }

    this.store.config = {
      checkoutEnabled: input.checkoutEnabled,
      softwareRequestAmountPaise: input.softwareRequestAmountPaise,
      creditsPerAiAction: input.creditsPerAiAction,
      plans,
      creditPacks,
    };
    this.persist();
    return this.adminConfiguration();
  }

  account(userId: string) {
    return {
      credits: this.creditBalance(userId),
      creditsPerAiAction: this.store.config.creditsPerAiAction,
      subscriptions: this.store.payments
        .filter((payment) => payment.userId === userId && payment.kind === 'subscription')
        .slice(-20)
        .reverse()
        .map((payment) => ({
          planId: payment.planId,
          interval: payment.planId ? this.store.config.plans[payment.planId].interval : null,
          status: payment.status,
          createdAt: payment.createdAt,
          paidAt: payment.paidAt,
        })),
      ledger: this.store.creditLedger
        .filter((entry) => entry.userId === userId && entry.status !== 'reserved')
        .slice(-50)
        .reverse()
        .map(({ id, reason, referenceId, status, delta, createdAt }) => ({
          id,
          reason,
          referenceId,
          status,
          delta,
          createdAt,
        })),
      payments: this.store.payments
        .filter((payment) => payment.userId === userId)
        .slice(-30)
        .reverse()
        .map(({ id, kind, amountPaise, currency, status, refundState, createdAt, paidAt }) => ({
          id,
          kind,
          amountPaise,
          currency,
          status,
          refundState,
          createdAt,
          paidAt,
        })),
    };
  }

  async createSubscriptionCheckout(
    userId: string,
    planId: BillingPlanId,
    idempotencyKey: string,
  ) {
    this.assertCheckoutEnabled();
    const plan = this.store.config.plans[planId];
    if (!plan || !plan.enabled || !isSafeInteger(plan.amountPaise, 1) || !plan.razorpayPlanId) {
      throw new ServiceUnavailableException('This subscription plan is not configured for checkout.');
    }
    const payment = this.beginPayment(userId, idempotencyKey, {
      kind: 'subscription',
      amountPaise: plan.amountPaise,
      planId,
    });
    if (payment.providerSubscriptionId) return this.checkoutDetails(payment);

    try {
      const providerPlan = await this.providerRequest<unknown>(
        'GET',
        `/plans/${encodeURIComponent(plan.razorpayPlanId)}`,
      );
      this.assertProviderPlan(providerPlan, plan);
      const subscription = await this.providerRequest<unknown>('POST', '/subscriptions', {
        plan_id: plan.razorpayPlanId,
        total_count: 100,
        customer_notify: 1,
        notes: { hexawave_payment_id: payment.id, hexawave_user_id: userId },
      });
      if (
        !isRecord(subscription) ||
        typeof subscription.id !== 'string' ||
        subscription.plan_id !== plan.razorpayPlanId
      ) {
        throw new ServiceUnavailableException('Razorpay returned an invalid subscription.');
      }
      payment.providerSubscriptionId = subscription.id;
      payment.status = 'pending';
      this.persist();
      return this.checkoutDetails(payment);
    } catch (error) {
      payment.status = 'failed';
      this.persist();
      throw error;
    }
  }

  async createCreditsCheckout(userId: string, packId: string, idempotencyKey: string) {
    this.assertCheckoutEnabled();
    const pack = this.store.config.creditPacks.find((item) => item.id === packId);
    if (!pack) throw new BadRequestException('This AI credit pack is not available.');
    const payment = this.beginPayment(userId, idempotencyKey, {
      kind: 'credits',
      amountPaise: pack.amountPaise,
      creditPackId: pack.id,
      credits: pack.credits,
    });
    if (payment.providerOrderId) return this.checkoutDetails(payment);
    return this.createProviderOrder(payment, `AI credits: ${pack.label}`);
  }

  async createSoftwareRequestCheckout(
    user: {
      id: string;
      email: string;
      accountType?: string;
      workspaceId?: string;
      companyName?: string;
    },
    input: unknown,
    idempotencyKey: string,
  ) {
    this.assertCheckoutEnabled();
    if (user.accountType !== 'company') {
      throw new BadRequestException('A company account is required for paid software requests.');
    }
    const amountPaise = this.store.config.softwareRequestAmountPaise;
    if (!isSafeInteger(amountPaise, 1)) {
      throw new ServiceUnavailableException('The company software request fee is not configured.');
    }
    if (!isRecord(input)) throw new BadRequestException('Software request details must be an object.');
    const companyName = user.accountType === 'company' ? user.companyName : input.companyName;
    const productName = input.productName;
    const purpose = input.purpose;
    if (
      typeof companyName !== 'string' ||
      companyName.trim().length < 1 ||
      companyName.trim().length > 80 ||
      typeof productName !== 'string' ||
      productName.trim().length < 1 ||
      productName.trim().length > 80 ||
      typeof purpose !== 'string' ||
      purpose.trim().length < 1 ||
      purpose.trim().length > 500
    ) {
      throw new BadRequestException('Company, product, and purpose details are required.');
    }
    if (
      !Array.isArray(input.languages) ||
      input.languages.length < 1 ||
      input.languages.length > 10 ||
      !input.languages.every((language) => typeof language === 'string')
    ) {
      throw new BadRequestException('Choose one or more supported programming languages.');
    }
    const languages = Array.from(
      new Set((input.languages as string[]).map((language) => language.trim()).filter(Boolean)),
    );
    const allowedLanguages = new Set<string>(KING_LANGUAGES);
    const unsupported = languages.filter((language) => !allowedLanguages.has(language));
    if (!languages.length || unsupported.length) {
      throw new BadRequestException('Choose one or more supported programming languages.');
    }

    const softwareRequest: SoftwareRequestDetails = {
      companyName: companyName.trim(),
      productName: productName.trim(),
      purpose: purpose.trim(),
      languages,
      requesterWorkspaceId: user.workspaceId ?? user.id,
      requesterEmail: user.email,
    };
    const payment = this.beginPayment(user.id, idempotencyKey, {
      kind: 'software-request',
      amountPaise,
      softwareRequest,
    });
    if (payment.providerOrderId) return this.checkoutDetails(payment);
    return this.createProviderOrder(payment, `Software request: ${productName.trim()}`);
  }

  async verifyCheckout(userId: string, input: unknown) {
    if (!isRecord(input)) throw new BadRequestException('Payment verification data is invalid.');
    const paymentId = input.paymentIntentId;
    const providerPaymentId = input.razorpay_payment_id;
    const signature = input.razorpay_signature;
    if (
      typeof paymentId !== 'string' ||
      typeof providerPaymentId !== 'string' ||
      typeof signature !== 'string'
    ) {
      throw new BadRequestException('Payment verification data is incomplete.');
    }
    const payment = this.store.payments.find((item) => item.id === paymentId);
    if (!payment || payment.userId !== userId) {
      throw new ConflictException('Payment intent not found for this account.');
    }
    if (payment.status === 'failed') throw new ConflictException('This payment attempt has failed.');
    const credentials = this.requireCredentials();

    if (payment.kind === 'subscription') {
      const subscriptionId = input.razorpay_subscription_id;
      if (
        typeof subscriptionId !== 'string' ||
        subscriptionId !== payment.providerSubscriptionId ||
        !this.verifySignature(
          `${providerPaymentId}|${subscriptionId}`,
          signature,
          credentials.keySecret,
        )
      ) {
        throw new ConflictException('Subscription payment signature is invalid.');
      }
      const [providerPayment, providerSubscription] = await Promise.all([
        this.providerRequest<unknown>('GET', `/payments/${encodeURIComponent(providerPaymentId)}`),
        this.providerRequest<unknown>(
          'GET',
          `/subscriptions/${encodeURIComponent(subscriptionId)}`,
        ),
      ]);
      this.assertProviderPayment(providerPayment, payment, providerPaymentId);
      if (
        !isRecord(providerSubscription) ||
        providerSubscription.id !== subscriptionId ||
        providerSubscription.plan_id !== this.store.config.plans[payment.planId!].razorpayPlanId ||
        !['active', 'authenticated'].includes(String(providerSubscription.status))
      ) {
        throw new ConflictException('Razorpay subscription is not active or does not match this plan.');
      }
      payment.status = 'paid';
      payment.providerPaymentId = providerPaymentId;
      payment.paidAt ??= new Date().toISOString();
      this.persist();
      return this.paymentResult(payment);
    }

    const orderId = input.razorpay_order_id;
    if (
      typeof orderId !== 'string' ||
      orderId !== payment.providerOrderId ||
      !this.verifySignature(
        `${orderId}|${providerPaymentId}`,
        signature,
        credentials.keySecret,
      )
    ) {
      throw new ConflictException('Order payment signature is invalid.');
    }
    const providerPayment = await this.providerRequest<unknown>(
      'GET',
      `/payments/${encodeURIComponent(providerPaymentId)}`,
    );
    this.assertProviderPayment(providerPayment, payment, providerPaymentId);
    this.markPaid(payment, providerPaymentId);
    return this.paymentResult(payment);
  }

  acceptWebhookPayment(entity: unknown) {
    if (
      !isRecord(entity) ||
      typeof entity.id !== 'string' ||
      typeof entity.order_id !== 'string'
    ) {
      throw new BadRequestException('Razorpay payment event is missing its payment or order ID.');
    }
    const payment = this.store.payments.find((item) => item.providerOrderId === entity.order_id);
    if (!payment) return null;
    this.assertProviderPayment(entity, payment, entity.id, false);
    if (entity.status !== 'captured') {
      throw new ConflictException('Only captured Razorpay payments can be fulfilled.');
    }
    this.markPaid(payment, entity.id);
    return this.paymentResult(payment);
  }

  acceptWebhookSubscription(entity: unknown) {
    if (!isRecord(entity) || typeof entity.id !== 'string') {
      throw new BadRequestException('Razorpay subscription event is missing its subscription ID.');
    }
    const payment = this.store.payments.find((item) => item.providerSubscriptionId === entity.id);
    if (!payment) return null;
    if (entity.plan_id !== this.store.config.plans[payment.planId!].razorpayPlanId) {
      throw new ConflictException('Razorpay subscription plan does not match this payment.');
    }
    if (entity.status === 'cancelled' || entity.status === 'halted') {
      payment.status = 'failed';
    } else if (entity.status === 'active') {
      payment.status = 'paid';
      payment.paidAt ??= new Date().toISOString();
    }
    this.persist();
    return this.paymentResult(payment);
  }

  markSoftwareRequestFulfilled(paymentId: string, requestId: string): void {
    const payment = this.store.payments.find((item) => item.id === paymentId);
    if (!payment || payment.kind !== 'software-request' || payment.status !== 'paid') {
      throw new ConflictException('A verified software request payment is required.');
    }
    if (payment.requestId && payment.requestId !== requestId) {
      throw new ConflictException('This payment is already linked to another request.');
    }
    payment.requestId = requestId;
    this.persist();
  }

  async refundSoftwareRequestPayment(paymentId: string): Promise<BillingRefundState> {
    const payment = this.store.payments.find((item) => item.id === paymentId);
    if (
      !payment ||
      payment.kind !== 'software-request' ||
      !['paid', 'refund_pending', 'refunded'].includes(payment.status) ||
      !payment.providerPaymentId
    ) {
      throw new ConflictException('A verified paid company-request payment is required before refund.');
    }
    if (payment.refundState === 'refunded' || payment.refundState === 'pending') {
      return payment.refundState;
    }
    if (payment.refundState === 'processing') {
      throw new ServiceUnavailableException(
        'The refund request is awaiting provider confirmation; check the signed refund webhook before retrying.',
      );
    }

    payment.refundState = 'processing';
    this.persist();
    const refund = await this.providerRequest<unknown>(
      'POST',
      `/payments/${encodeURIComponent(payment.providerPaymentId)}/refund`,
      { amount: payment.amountPaise, notes: { hexawave_payment_id: payment.id } },
    );
    if (
      !isRecord(refund) ||
      typeof refund.id !== 'string' ||
      refund.amount !== payment.amountPaise ||
      refund.payment_id !== payment.providerPaymentId
    ) {
      throw new ServiceUnavailableException(
        'Razorpay did not confirm a full refund for this company-request payment.',
      );
    }
    payment.refundId = refund.id;
    if (refund.status === 'processed') {
      payment.refundState = 'refunded';
      payment.status = 'refunded';
    } else if (refund.status === 'pending') {
      payment.refundState = 'pending';
      payment.status = 'refund_pending';
    } else if (refund.status === 'failed') {
      payment.refundState = 'failed';
      payment.status = 'paid';
      this.persist();
      throw new ServiceUnavailableException('Razorpay could not process the refund.');
    } else {
      throw new ServiceUnavailableException('Razorpay returned an unknown refund status.');
    }
    this.persist();
    return payment.refundState;
  }

  updateRefundFromWebhook(entity: unknown, event: string) {
    if (
      !isRecord(entity) ||
      typeof entity.id !== 'string' ||
      typeof entity.payment_id !== 'string' ||
      !isSafeInteger(entity.amount, 1)
    ) {
      throw new BadRequestException('Razorpay refund event is malformed.');
    }
    const payment = this.store.payments.find(
      (item) => item.providerPaymentId === entity.payment_id && item.refundId === entity.id,
    );
    if (!payment || payment.kind !== 'software-request' || entity.amount !== payment.amountPaise) {
      throw new ConflictException('Razorpay refund does not match a full company-request payment refund.');
    }
    if (event === 'refund.processed') {
      payment.refundState = 'refunded';
      payment.status = 'refunded';
    } else if (event === 'refund.failed') {
      payment.refundState = 'failed';
      payment.status = 'paid';
    } else {
      throw new BadRequestException('Unsupported Razorpay refund event.');
    }
    this.persist();
    return { paymentIntentId: payment.id, refundState: payment.refundState };
  }

  softwareRequestForFulfillment(paymentId: string) {
    const payment = this.store.payments.find((item) => item.id === paymentId);
    if (
      !payment ||
      payment.kind !== 'software-request' ||
      payment.status !== 'paid' ||
      !payment.softwareRequest ||
      payment.requestId
    ) {
      return null;
    }
    return {
      paymentId: payment.id,
      request: structuredClone(payment.softwareRequest),
    };
  }

  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    const secret = process.env.HEXAWAVE_RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException('Razorpay webhook verification is not configured.');
    }
    if (!rawBody || !signature || !this.verifySignature(rawBody, signature, secret)) {
      throw new ConflictException('Razorpay webhook signature is invalid.');
    }
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException('Razorpay webhook body is not valid JSON.');
    }
    if (!isRecord(payload) || typeof payload.event !== 'string' || !isRecord(payload.payload)) {
      throw new BadRequestException('Razorpay webhook event is malformed.');
    }
    const eventId = payload.id;
    if (typeof eventId === 'string' && this.store.webhookEventIds.includes(eventId)) {
      return { success: true, duplicate: true };
    }
    let paymentResult: ReturnType<BillingService['paymentResult']> | null = null;
    let refundResult: ReturnType<BillingService['updateRefundFromWebhook']> | null = null;
    const paymentEntity =
      isRecord(payload.payload.payment) && isRecord(payload.payload.payment.entity)
        ? payload.payload.payment.entity
        : null;
    const subscriptionEntity =
      isRecord(payload.payload.subscription) && isRecord(payload.payload.subscription.entity)
        ? payload.payload.subscription.entity
        : null;
    if (['payment.captured', 'order.paid'].includes(payload.event) && paymentEntity) {
      paymentResult = this.acceptWebhookPayment(paymentEntity);
    } else if (
      ['subscription.activated', 'subscription.charged', 'subscription.cancelled', 'subscription.halted'].includes(
        payload.event,
      ) &&
      subscriptionEntity
    ) {
      paymentResult = this.acceptWebhookSubscription(subscriptionEntity);
    }
    const refundEntity =
      isRecord(payload.payload.refund) && isRecord(payload.payload.refund.entity)
        ? payload.payload.refund.entity
        : null;
    if (['refund.processed', 'refund.failed'].includes(payload.event) && refundEntity) {
      refundResult = this.updateRefundFromWebhook(refundEntity, payload.event);
    }
    return {
      success: true,
      eventId: typeof eventId === 'string' ? eventId : null,
      fulfilledPaymentId: paymentResult?.paymentIntentId ?? null,
      refundPaymentId: refundResult?.paymentIntentId ?? null,
      refundState: refundResult?.refundState ?? null,
    };
  }

  completeWebhook(eventId: string | null): void {
    if (!eventId || this.store.webhookEventIds.includes(eventId)) return;
    this.store.webhookEventIds.push(eventId);
    this.store.webhookEventIds = this.store.webhookEventIds.slice(-MAX_WEBHOOK_EVENTS);
    this.persist();
  }

  async executeAiAction<T>(userId: string, action: () => Promise<T>): Promise<T> {
    const cost = this.store.config.creditsPerAiAction;
    if (cost === 0) return action();
    const reservation = this.reserveAiAction(userId, cost);
    try {
      const result = await action();
      if (isRecord(result) && (result.success === false || result.status === 'failed')) {
        this.releaseAiAction(reservation);
      } else {
        this.commitAiAction(reservation);
      }
      return result;
    } catch (error) {
      this.releaseAiAction(reservation);
      throw error;
    }
  }

  private async createProviderOrder(payment: StoredPayment, description: string) {
    try {
      const order = await this.providerRequest<unknown>('POST', '/orders', {
        amount: payment.amountPaise,
        currency: payment.currency,
        receipt: payment.id.slice(0, 40),
        notes: {
          hexawave_payment_id: payment.id,
          hexawave_user_id: payment.userId,
          hexawave_kind: payment.kind,
        },
      });
      if (
        !isRecord(order) ||
        typeof order.id !== 'string' ||
        order.amount !== payment.amountPaise ||
        order.currency !== payment.currency
      ) {
        throw new ServiceUnavailableException('Razorpay returned an order that does not match the configured amount.');
      }
      payment.providerOrderId = order.id;
      payment.status = 'pending';
      this.persist();
      return { ...this.checkoutDetails(payment), description };
    } catch (error) {
      payment.status = 'failed';
      this.persist();
      throw error;
    }
  }

  private beginPayment(
    userId: string,
    idempotencyKey: string,
    data: Pick<StoredPayment, 'kind' | 'amountPaise'> &
      Partial<Pick<StoredPayment, 'planId' | 'creditPackId' | 'credits' | 'softwareRequest'>>,
  ): StoredPayment {
    if (
      typeof idempotencyKey !== 'string' ||
      idempotencyKey.length < 8 ||
      idempotencyKey.length > 100
    ) {
      throw new BadRequestException('A valid checkout idempotency key is required.');
    }
    const previous = this.store.payments.find(
      (item) =>
        item.userId === userId &&
        item.idempotencyKey === idempotencyKey &&
        item.kind === data.kind,
    );
    if (previous) {
      if (previous.status === 'failed') {
        throw new ConflictException('This checkout attempt failed; start a new checkout.');
      }
      if (previous.status === 'creating') {
        throw new ConflictException('This checkout attempt is still being created.');
      }
      if (
        previous.amountPaise !== data.amountPaise ||
        previous.planId !== data.planId ||
        previous.creditPackId !== data.creditPackId ||
        JSON.stringify(previous.softwareRequest) !== JSON.stringify(data.softwareRequest)
      ) {
        throw new ConflictException('This idempotency key is already bound to different checkout details.');
      }
      return previous;
    }
    const payment: StoredPayment = {
      id: randomUUID(),
      userId,
      idempotencyKey,
      ...data,
      currency: 'INR',
      status: 'creating',
      createdAt: new Date().toISOString(),
    };
    this.store.payments.push(payment);
    this.persist();
    return payment;
  }

  private checkoutDetails(payment: StoredPayment) {
    const credentials = this.requireCredentials();
    return {
      paymentIntentId: payment.id,
      kind: payment.kind,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      keyId: credentials.keyId,
      ...(payment.providerOrderId ? { orderId: payment.providerOrderId } : {}),
      ...(payment.providerSubscriptionId ? { subscriptionId: payment.providerSubscriptionId } : {}),
    };
  }

  private paymentResult(payment: StoredPayment) {
    return {
      success: true,
      paymentIntentId: payment.id,
      kind: payment.kind,
      status: payment.status,
      ...(payment.requestId ? { requestId: payment.requestId } : {}),
      ...(payment.softwareRequest ? { softwareRequest: structuredClone(payment.softwareRequest) } : {}),
    };
  }

  private markPaid(payment: StoredPayment, providerPaymentId: string): void {
    if (payment.status === 'paid') return;
    payment.status = 'paid';
    payment.providerPaymentId = providerPaymentId;
    payment.paidAt = new Date().toISOString();
    if (payment.kind === 'credits') {
      const alreadyCredited = this.store.creditLedger.some(
        (entry) => entry.reason === 'purchase' && entry.referenceId === payment.id,
      );
      if (!alreadyCredited) {
        this.store.creditLedger.push({
          id: randomUUID(),
          userId: payment.userId,
          reason: 'purchase',
          referenceId: payment.id,
          status: 'credited',
          delta: payment.credits ?? 0,
          createdAt: payment.paidAt,
        });
      }
    }
    this.persist();
  }

  private assertProviderPayment(
    input: unknown,
    expected: StoredPayment,
    expectedPaymentId: string,
    requireCaptured = true,
  ): asserts input is ProviderPayment {
    if (
      !isRecord(input) ||
      input.id !== expectedPaymentId ||
      input.amount !== expected.amountPaise ||
      input.currency !== expected.currency ||
      (requireCaptured && input.status !== 'captured')
    ) {
      throw new ConflictException('Razorpay payment status or amount does not match this checkout.');
    }
    if (
      expected.kind === 'subscription'
        ? input.subscription_id !== expected.providerSubscriptionId
        : input.order_id !== expected.providerOrderId
    ) {
      throw new ConflictException('Razorpay payment does not belong to this checkout.');
    }
  }

  private assertProviderPlan(input: unknown, expected: BillingPlan): void {
    const period = expected.interval === 'monthly' ? 'monthly' : 'yearly';
    if (
      !isRecord(input) ||
      !isRecord(input.item) ||
      input.item.amount !== expected.amountPaise ||
      input.item.currency !== 'INR' ||
      input.period !== period
    ) {
      throw new ConflictException(
        'The Razorpay plan amount, currency, or billing interval does not match King billing settings.',
      );
    }
  }

  private reserveAiAction(userId: string, cost: number): string {
    const reserved = this.store.creditLedger
      .filter((entry) => entry.userId === userId && entry.status === 'reserved')
      .reduce((total, entry) => total + Math.abs(entry.delta), 0);
    if (this.creditBalance(userId) - reserved < cost) {
      throw new ConflictException('Not enough AI credits. Purchase a credit pack to continue.');
    }
    const id = randomUUID();
    this.store.creditLedger.push({
      id,
      userId,
      reason: 'ai-action',
      referenceId: id,
      status: 'reserved',
      delta: -cost,
      createdAt: new Date().toISOString(),
    });
    this.persist();
    return id;
  }

  private commitAiAction(reservationId: string): void {
    const entry = this.store.creditLedger.find((item) => item.id === reservationId);
    if (entry?.status !== 'reserved') {
      throw new ConflictException('AI credit reservation is no longer available.');
    }
    entry.status = 'charged';
    this.persist();
  }

  private releaseAiAction(reservationId: string): void {
    const entry = this.store.creditLedger.find((item) => item.id === reservationId);
    if (!entry || entry.status !== 'reserved') return;
    entry.status = 'released';
    this.persist();
  }

  private creditBalance(userId: string): number {
    return this.store.creditLedger
      .filter(
        (entry) =>
          entry.userId === userId &&
          (entry.status === 'credited' || entry.status === 'charged'),
      )
      .reduce((total, entry) => total + entry.delta, 0);
  }

  private assertCheckoutEnabled(): void {
    if (
      ['HEXAWAVE_ENV', 'NODE_ENV', 'APP_ENV'].some(
        (name) => process.env[name]?.trim().toLowerCase() === 'production',
      )
    ) {
      throw new ServiceUnavailableException(
        'Razorpay checkout is disabled in production until transaction-safe shared payment storage is configured.',
      );
    }
    if (!this.store.config.checkoutEnabled) {
      throw new ServiceUnavailableException('Razorpay checkout is disabled by King.');
    }
    this.requireCredentials();
    if (!process.env.HEXAWAVE_RAZORPAY_WEBHOOK_SECRET) {
      throw new ServiceUnavailableException('Razorpay webhook verification is not configured.');
    }
  }

  private isProviderConfigured(): boolean {
    try {
      const credentials = this.readCredentials();
      return Boolean(
        credentials &&
          !['HEXAWAVE_ENV', 'NODE_ENV', 'APP_ENV'].some(
            (name) => process.env[name]?.trim().toLowerCase() === 'production',
          ) &&
          (!credentials.keyId.startsWith('rzp_live_') ||
            process.env.HEXAWAVE_RAZORPAY_LIVE_ENABLED === 'true'),
      );
    } catch {
      return false;
    }
  }

  private requireCredentials(): ProviderCredentials {
    const credentials = this.readCredentials();
    if (!credentials) {
      throw new ServiceUnavailableException('Razorpay server credentials are not configured.');
    }
    if (
      credentials.keyId.startsWith('rzp_live_') &&
      process.env.HEXAWAVE_RAZORPAY_LIVE_ENABLED !== 'true'
    ) {
      throw new ServiceUnavailableException('Live Razorpay payments are disabled until explicitly enabled in server configuration.');
    }
    return credentials;
  }

  private readCredentials(): ProviderCredentials | null {
    const keyId = process.env.HEXAWAVE_RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.HEXAWAVE_RAZORPAY_KEY_SECRET;
    if (!keyId && !keySecret) return null;
    if (!keyId || !keySecret || !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
      throw new ServiceUnavailableException('Razorpay credentials are incomplete or invalid.');
    }
    return { keyId, keySecret };
  }

  private async providerRequest<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const credentials = this.requireCredentials();
    let response: Response;
    try {
      response = await fetch(`${RAZORPAY_API}${path}`, {
        method,
        headers: {
          Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ServiceUnavailableException('Could not reach Razorpay. No payment was confirmed.');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Razorpay rejected the ${method.toLowerCase()} payment request (${response.status}).`,
      );
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new ServiceUnavailableException('Razorpay returned an unreadable response.');
    }
  }

  private verifySignature(
    message: string | Buffer,
    suppliedSignature: string,
    secret: string,
  ): boolean {
    if (!/^[a-f\d]{64}$/i.test(suppliedSignature)) return false;
    const expected = createHmac('sha256', secret).update(message).digest();
    const supplied = Buffer.from(suppliedSignature, 'hex');
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  private load(): void {
    if (!existsSync(this.storePath)) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.storePath, 'utf8')) as unknown;
    } catch {
      throw new Error('Billing data could not be parsed; refusing to start with an empty billing store.');
    }
    if (
      !isRecord(parsed) ||
      !this.isConfiguration(parsed.config) ||
      !Array.isArray(parsed.payments) ||
      !Array.isArray(parsed.creditLedger) ||
      !Array.isArray(parsed.webhookEventIds)
    ) {
      throw new Error('Billing data has an invalid format; refusing to start with an empty billing store.');
    }
    this.store = {
      config: parsed.config,
      payments: parsed.payments as StoredPayment[],
      creditLedger: parsed.creditLedger as CreditLedgerEntry[],
      webhookEventIds: parsed.webhookEventIds.filter(
        (value): value is string => typeof value === 'string',
      ),
    };
  }

  private isConfiguration(value: unknown): value is BillingConfiguration {
    if (
      !isRecord(value) ||
      typeof value.checkoutEnabled !== 'boolean' ||
      (value.softwareRequestAmountPaise !== null &&
        !isSafeInteger(value.softwareRequestAmountPaise, 1)) ||
      !isSafeInteger(value.creditsPerAiAction, 0) ||
      !isRecord(value.plans) ||
      !Array.isArray(value.creditPacks)
    ) {
      return false;
    }
    const plans = value.plans;
    if (!isRecord(plans)) return false;
    return (['pro', 'team', 'enterprise'] as const).every((id) => {
      const plan = plans[id];
      return (
        isRecord(plan) &&
        typeof plan.enabled === 'boolean' &&
        (plan.amountPaise === null || isSafeInteger(plan.amountPaise, 1)) &&
        (plan.interval === 'monthly' || plan.interval === 'yearly') &&
        typeof plan.razorpayPlanId === 'string'
      );
    });
  }

  private persist(): void {
    mkdirSync(dirname(this.storePath), { recursive: true });
    const temporaryPath = `${this.storePath}.${randomUUID()}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(this.store, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    renameSync(temporaryPath, this.storePath);
  }
}
