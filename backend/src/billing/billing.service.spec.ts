import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BillingService, type BillingConfiguration } from './billing.service';

describe('BillingService', () => {
  let service: BillingService;
  let temporaryDirectory: string;
  let currentOrderId: string;
  let currentPaymentId: string;
  const keySecret = 'razorpay-test-secret';

  const configuration: BillingConfiguration = {
    checkoutEnabled: true,
    softwareRequestAmountPaise: 25000,
    creditsPerAiAction: 2,
    plans: {
      pro: { enabled: false, amountPaise: null, interval: 'monthly', razorpayPlanId: '' },
      team: { enabled: false, amountPaise: null, interval: 'monthly', razorpayPlanId: '' },
      enterprise: { enabled: false, amountPaise: null, interval: 'monthly', razorpayPlanId: '' },
    },
    creditPacks: [{ id: 'starter', label: 'Starter', credits: 10, amountPaise: 50000 }],
  };

  function signature(value: string | Buffer, secret = keySecret): string {
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), 'hexawave-billing-'));
    vi.stubEnv('HEXAWAVE_BILLING_STORE', join(temporaryDirectory, 'billing.json'));
    vi.stubEnv('HEXAWAVE_RAZORPAY_KEY_ID', 'rzp_test_fixture');
    vi.stubEnv('HEXAWAVE_RAZORPAY_KEY_SECRET', keySecret);
    vi.stubEnv('HEXAWAVE_RAZORPAY_WEBHOOK_SECRET', 'webhook-test-secret');
    currentOrderId = 'order_fixture';
    currentPaymentId = 'pay_fixture';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        if (url.endsWith('/plans/plan_profixture')) {
          return new Response(
            JSON.stringify({
              period: 'monthly',
              item: { amount: 10000, currency: 'INR' },
            }),
            { status: 200 },
          );
        }
        if (url.endsWith('/subscriptions')) {
          return new Response(
            JSON.stringify({ id: 'sub_fixture', plan_id: 'plan_profixture' }),
            { status: 200 },
          );
        }
        if (url.endsWith('/orders')) {
          return new Response(
            JSON.stringify({
              id: currentOrderId,
              amount: 50000,
              currency: 'INR',
            }),
            { status: 200 },
          );
        }
        if (url.endsWith(`/payments/${currentPaymentId}`)) {
          return new Response(
            JSON.stringify({
              id: currentPaymentId,
              order_id: currentOrderId,
              amount: 50000,
              currency: 'INR',
              status: 'captured',
            }),
            { status: 200 },
          );
        }
        throw new Error(`Unexpected Razorpay request: ${url}`);
      }),
    );
    service = new BillingService();
    service.updateConfiguration(configuration);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('keeps checkout disabled by default and validates admin plan configuration', () => {
    vi.stubEnv('HEXAWAVE_BILLING_STORE', join(temporaryDirectory, 'empty.json'));
    const unconfigured = new BillingService();
    expect(unconfigured.publicCatalog().checkoutAvailable).toBe(false);
    expect(() =>
      unconfigured.updateConfiguration({
        ...configuration,
        plans: {
          ...configuration.plans,
          pro: {
            enabled: true,
            amountPaise: 10000,
            interval: 'monthly',
            razorpayPlanId: '',
          },
        },
      }),
    ).toThrow('Configure both a price and a Razorpay plan ID');
  });

  it('credits only a captured payment owned by the caller and charges successful AI actions', async () => {
    const checkout = await service.createCreditsCheckout('user-a', 'starter', 'stable-checkout-key');
    expect(checkout.orderId).toBe(currentOrderId);
    await expect(
      service.verifyCheckout('user-b', {
        paymentIntentId: checkout.paymentIntentId,
        razorpay_order_id: currentOrderId,
        razorpay_payment_id: currentPaymentId,
        razorpay_signature: signature(`${currentOrderId}|${currentPaymentId}`),
      }),
    ).rejects.toThrow('not found for this account');
    expect(service.account('user-a').credits).toBe(0);

    await expect(
      service.verifyCheckout('user-a', {
        paymentIntentId: checkout.paymentIntentId,
        razorpay_order_id: currentOrderId,
        razorpay_payment_id: currentPaymentId,
        razorpay_signature: signature(`${currentOrderId}|${currentPaymentId}`),
      }),
    ).resolves.toMatchObject({ success: true, status: 'paid' });
    expect(service.account('user-a').credits).toBe(10);

    await expect(
      service.executeAiAction('user-a', async () => ({ success: false })),
    ).resolves.toEqual({ success: false });
    expect(service.account('user-a').credits).toBe(10);
    await expect(
      service.executeAiAction('user-a', async () => ({ success: true })),
    ).resolves.toEqual({ success: true });
    expect(service.account('user-a').credits).toBe(8);
    await expect(
      service.executeAiAction('user-b', async () => ({ success: true })),
    ).rejects.toThrow('Not enough AI credits');
  });

  it('rejects forged signatures and mismatched captured amounts', async () => {
    const checkout = await service.createCreditsCheckout('user-a', 'starter', 'checkout-key-2');
    await expect(
      service.verifyCheckout('user-a', {
        paymentIntentId: checkout.paymentIntentId,
        razorpay_order_id: currentOrderId,
        razorpay_payment_id: currentPaymentId,
        razorpay_signature: '0'.repeat(64),
      }),
    ).rejects.toThrow('signature is invalid');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: currentPaymentId,
            order_id: currentOrderId,
            amount: 100,
            currency: 'INR',
            status: 'captured',
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      service.verifyCheckout('user-a', {
        paymentIntentId: checkout.paymentIntentId,
        razorpay_order_id: currentOrderId,
        razorpay_payment_id: currentPaymentId,
        razorpay_signature: signature(`${currentOrderId}|${currentPaymentId}`),
      }),
    ).rejects.toThrow('amount does not match');
    expect(service.account('user-a').credits).toBe(0);
  });

  it('handles duplicate signed webhooks idempotently', async () => {
    const checkout = await service.createCreditsCheckout('user-a', 'starter', 'checkout-key-3');
    const payload = Buffer.from(
      JSON.stringify({
        id: 'event_capture_once',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: currentPaymentId,
              order_id: currentOrderId,
              amount: 50000,
              currency: 'INR',
              status: 'captured',
            },
          },
        },
      }),
    );
    const webhookSignature = signature(payload, 'webhook-test-secret');

    const first = await service.handleWebhook(payload, webhookSignature);
    service.completeWebhook(first.eventId);
    const duplicate = await service.handleWebhook(payload, webhookSignature);

    expect(first.fulfilledPaymentId).toBe(checkout.paymentIntentId);
    expect(duplicate).toEqual({ success: true, duplicate: true });
    expect(service.account('user-a').credits).toBe(10);
  });

  it('requires explicit live-payment enablement', () => {
    vi.stubEnv('HEXAWAVE_RAZORPAY_KEY_ID', 'rzp_live_fixture');
    vi.stubEnv('HEXAWAVE_RAZORPAY_LIVE_ENABLED', 'false');
    return expect(
      service.createCreditsCheckout('user-a', 'starter', 'checkout-key-4'),
    ).rejects.toThrow('Live Razorpay payments are disabled');
  });

  it('checks recurring Razorpay plan price and interval before creating a subscription', async () => {
    service.updateConfiguration({
      ...configuration,
      plans: {
        ...configuration.plans,
        pro: {
          enabled: true,
          amountPaise: 10000,
          interval: 'monthly',
          razorpayPlanId: 'plan_profixture',
        },
      },
    });
    await expect(
      service.createSubscriptionCheckout('user-a', 'pro', 'subscription-checkout'),
    ).resolves.toMatchObject({
      kind: 'subscription',
      subscriptionId: 'sub_fixture',
      amountPaise: 10000,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            period: 'monthly',
            item: { amount: 25000, currency: 'INR' },
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      service.createSubscriptionCheckout('user-a', 'pro', 'subscription-checkout-2'),
    ).rejects.toThrow('does not match King billing settings');
  });

  it('disables gateway checkout in production while the JSON store is in use', async () => {
    vi.stubEnv('HEXAWAVE_ENV', 'production');
    expect(service.publicCatalog().checkoutAvailable).toBe(false);
    await expect(
      service.createCreditsCheckout('user-a', 'starter', 'production-checkout'),
    ).rejects.toThrow('transaction-safe shared payment storage');
  });
});
