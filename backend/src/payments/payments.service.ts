import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database/database.service';
import { ClientsService } from '../clients/clients.service';
import { ConfigService } from '@nestjs/config';

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export type TransactionStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export interface CreateOrderInput {
  clientId: string;
  projectId?: string;
  amount: number;
  currency?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentOrder {
  id: string;
  orderId: string;
  clientId: string;
  projectId: string | null;
  amount: number;
  currency: string;
  paymentId: string | null;
  signature: string | null;
  status: PaymentStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  transactionId: string | null;
  amount: number;
  currency: string;
  gateway: string;
  method: string | null;
  bankReference: string | null;
  status: TransactionStatus;
  failureReason: string | null;
  webhookReceived: boolean;
  webhookSignature: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  notes: Array<{ note: string; created_at: number }>;
  created_at: number;
}

export interface RazorpayPaymentResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  order_id: string;
  invoice_id: string | null;
  international: boolean;
  method: string;
  amount_refunded: number;
  refund_status: string | null;
  captured: boolean;
  description: string | null;
  card_id: string | null;
  bank: string | null;
  wallet: string | null;
  vpa: string | null;
  email: string;
  contact: string;
  notes: Array<{ note: string; created_at: number }>;
  fee: number;
  tax: number;
  error_code: string | null;
  error_description: string | null;
  error_source: string | null;
  error_step: string | null;
  error_reason: string | null;
  acq_data: unknown;
  created_at: number;
}

@Injectable()
export class PaymentsService {
  private readonly razorpayKeyId: string;
  private readonly razorpayKeySecret: string;
  private readonly webhookSecret: string;
  private readonly testMode: boolean;

  constructor(
    private readonly database: DatabaseService,
    private readonly clientsService: ClientsService,
    private readonly configService: ConfigService,
  ) {
    this.razorpayKeyId = this.configService.get<string>('RAZORPAY_KEY_ID') ?? '';
    this.razorpayKeySecret = this.configService.get<string>('RAZORPAY_KEY_SECRET') ?? '';
    this.webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') ?? '';
    this.testMode = this.configService.get<string>('RAZORPAY_TEST_MODE', 'false') === 'true';
  }

  // ============================================================================
  // Order Management
  // ============================================================================

  async createOrder(input: CreateOrderInput): Promise<{ 
    success: boolean; 
    order: PaymentOrder; 
    razorpayOrder?: RazorpayOrderResponse;
  }> {
    // Validate inputs
    if (!input.clientId) {
      throw new BadRequestException('Client ID is required');
    }
    
    if (!input.amount || input.amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }
    
    if (input.amount > 10000000) {
      throw new BadRequestException('Amount exceeds maximum limit');
    }
    
    if (input.projectId) {
      // Verify project exists and belongs to client
      try {
        const project = await this.clientsService.getClientProjectById(input.projectId);
        if (project.clientId !== input.clientId) {
          throw new ForbiddenException('Project does not belong to this client');
        }
      } catch (error) {
        throw new NotFoundException(`Project not found: ${input.projectId}`);
      }
    }
    
    const currency = input.currency ?? 'INR';
    const supportedCurrencies = ['INR', 'USD', 'EUR', 'GBP'];
    if (!supportedCurrencies.includes(currency)) {
      throw new BadRequestException(`Unsupported currency: ${currency}`);
    }
    
    // Check if there's already a pending order for this project
    if (input.projectId) {
      const existing = await this.getActiveOrderForProject(input.projectId);
      if (existing) {
        throw new ConflictException('An active order already exists for this project');
      }
    }
    
    // Create order record in database
    const orderId = randomUUID();
    const razorpayOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const dbOrder = await this.database.query<PaymentOrder>(
      `INSERT INTO payment_orders (
        id, order_id, client_id, project_id, amount, currency,
        status, notes, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING 
        id, order_id AS "orderId", client_id AS "clientId", 
        project_id AS "projectId", amount, currency, 
        payment_id AS "paymentId", signature, status, 
        notes, metadata, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        orderId,
        razorpayOrderId,
        input.clientId,
        input.projectId ?? null,
        input.amount,
        currency,
        'CREATED' as PaymentStatus,
        input.notes ?? null,
        input.metadata ?? {},
      ],
    );
    
    const order = this.normalizeOrder(dbOrder.rows[0]);
    
    // Create Razorpay order if API is configured
    let razorpayOrder: RazorpayOrderResponse | undefined;
    if (this.razorpayKeyId && this.razorpayKeySecret) {
      try {
        razorpayOrder = await this.createRazorpayOrder(
          razorpayOrderId,
          input.amount,
          currency,
          input.notes || `Order for ${input.clientId}`,
        );
        
        // Update order with actual Razorpay order ID
        await this.database.query(
          'UPDATE payment_orders SET order_id = $1 WHERE id = $2',
          [razorpayOrder.id, orderId],
        );
        
        // Update the returned order
        order.orderId = razorpayOrder.id;
      } catch (error) {
        // Log error but don't fail - we have the database record
        console.error('Failed to create Razorpay order:', error);
        
        // Update order status to FAILED
        await this.database.query(
          'UPDATE payment_orders SET status = $1 WHERE id = $2',
          ['FAILED' as PaymentStatus, orderId],
        );
        
        order.status = 'FAILED';
      }
    }
    
    // Record audit event
    await this.recordAuditEvent(
      input.clientId,
      'ORDER_CREATED',
      'SUCCESS',
      { orderId: order.id, razorpayOrderId: order.orderId, amount: order.amount, currency: order.currency },
    );
    
    return { success: true, order, razorpayOrder };
  }

  async getOrder(orderId: string): Promise<PaymentOrder> {
    const result = await this.database.query<PaymentOrder>(
      `SELECT 
        id, order_id AS "orderId", client_id AS "clientId",
        project_id AS "projectId", amount, currency,
        payment_id AS "paymentId", signature, status, notes, metadata,
        created_at AS "createdAt", updated_at AS "updatedAt"
       FROM payment_orders 
       WHERE id = $1 OR order_id = $1`,
      [orderId],
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }
    
    return this.normalizeOrder(result.rows[0]);
  }

  async getOrdersByClient(clientId: string): Promise<PaymentOrder[]> {
    const result = await this.database.query<PaymentOrder>(
      `SELECT 
        id, order_id AS "orderId", client_id AS "clientId",
        project_id AS "projectId", amount, currency,
        payment_id AS "paymentId", signature, status, notes, metadata,
        created_at AS "createdAt", updated_at AS "updatedAt"
       FROM payment_orders 
       WHERE client_id = $1 
       ORDER BY created_at DESC`,
      [clientId],
    );
    
    return result.rows.map(this.normalizeOrder);
  }

  async getOrdersByProject(projectId: string): Promise<PaymentOrder[]> {
    const result = await this.database.query<PaymentOrder>(
      `SELECT 
        id, order_id AS "orderId", client_id AS "clientId",
        project_id AS "projectId", amount, currency,
        payment_id AS "paymentId", signature, status, notes, metadata,
        created_at AS "createdAt", updated_at AS "updatedAt"
       FROM payment_orders 
       WHERE project_id = $1 
       ORDER BY created_at DESC`,
      [projectId],
    );
    
    return result.rows.map(this.normalizeOrder);
  }

  async getActiveOrderForProject(projectId: string): Promise<PaymentOrder | null> {
    const result = await this.database.query<PaymentOrder>(
      `SELECT 
        id, order_id AS "orderId", client_id AS "clientId",
        project_id AS "projectId", amount, currency,
        payment_id AS "paymentId", signature, status, notes, metadata,
        created_at AS "createdAt", updated_at AS "updatedAt"
       FROM payment_orders 
       WHERE project_id = $1 
         AND status IN ('CREATED', 'PENDING')
       ORDER BY created_at DESC 
       LIMIT 1`,
      [projectId],
    );
    
    return result.rows.length > 0 ? this.normalizeOrder(result.rows[0]) : null;
  }

  // ============================================================================
  // Payment Verification
  // ============================================================================

  async verifyPayment(
    orderId: string,
    paymentId: string,
    signature: string,
  ): Promise<{ success: boolean; order: PaymentOrder; transaction?: PaymentTransaction }> {
    // First, get the order
    const order = await this.getOrder(orderId);
    
    if (order.status === 'PAID') {
      // Already verified - prevent duplicate processing
      return { success: true, order };
    }
    
    // Verify signature
    const isValid = this.verifyRazorpaySignature(orderId, paymentId, signature);
    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }
    
    // Get payment details from Razorpay
    let razorpayPayment: RazorpayPaymentResponse | null = null;
    try {
      razorpayPayment = await this.getRazorpayPayment(paymentId);
    } catch (error) {
      console.error('Failed to fetch payment details:', error);
      // Continue without Razorpay details if API fails
    }
    
    // Create transaction record
    const transactionId = randomUUID();
    const txn = await this.database.query<PaymentTransaction>(
      `INSERT INTO payment_transactions (
        id, order_id, transaction_id, amount, currency, gateway, method,
        bank_reference, status, webhook_received, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING 
        id, order_id AS "orderId", transaction_id AS "transactionId",
        amount, currency, gateway, method, bank_reference AS "bankReference",
        status, failure_reason AS "failureReason", webhook_received AS "webhookReceived",
        webhook_signature AS "webhookSignature", processed_at AS "processedAt",
        created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        transactionId,
        order.id,
        paymentId,
        order.amount,
        order.currency,
        'razorpay' as string,
        razorpayPayment?.method ?? null,
        razorpayPayment?.bank ?? null,
        razorpayPayment?.status === 'captured' ? 'SUCCESS' : 'PENDING' as TransactionStatus,
        false,
      ],
    );
    
    const transaction = this.normalizeTransaction(txn.rows[0]);
    
    // Update order with payment details
    const status: PaymentStatus = razorpayPayment?.status === 'captured' ? 'PAID' : 'PENDING';
    
    await this.database.query(
      `UPDATE payment_orders 
       SET payment_id = $1, signature = $2, status = $3, updated_at = NOW()
       WHERE id = $4`,
      [paymentId, signature, status, order.id],
    );
    
    // Update project status if this is a successful payment
    if (status === 'PAID' && order.projectId) {
      await this.clientsService.updateClientProject(
        order.clientId,
        order.projectId,
        { status: 'PAID' },
      );
      
      // Record audit event
      await this.recordAuditEvent(
        order.clientId,
        'PAYMENT_RECEIVED',
        'SUCCESS',
        { 
          orderId: order.id, 
          paymentId,
          amount: order.amount,
          currency: order.currency,
          projectId: order.projectId
        },
      );
    } else {
      // Record audit event for pending
      await this.recordAuditEvent(
        order.clientId,
        'PAYMENT_PENDING',
        'SUCCESS',
        { 
          orderId: order.id, 
          paymentId,
          amount: order.amount,
          currency: order.currency
        },
      );
    }
    
    return { success: true, order: { ...order, status }, transaction };
  }

  // ============================================================================
  // Webhook Processing
  // ============================================================================

  async processWebhook(
    rawBody: string,
    signature: string,
  ): Promise<{ success: boolean; processed: boolean; order?: PaymentOrder }> {
    // Verify webhook signature
    const expectedSignature = this.generateWebhookSignature(rawBody);
    if (!this.timingSafeCompare(signature, expectedSignature)) {
      console.error('Invalid webhook signature');
      return { success: false, processed: false };
    }
    
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      console.error('Failed to parse webhook payload:', error);
      return { success: false, processed: false };
    }
    
    if (!payload || typeof payload !== 'object') {
      return { success: false, processed: false };
    }
    
    const payloadObj = payload as Record<string, unknown>;
    const event = (payloadObj as any)['event'] as string;
    const payloadData = (payloadObj as any)['payload'] as Record<string, unknown>;
    const entity = payloadData?.['entity'] as Record<string, unknown>;
    
    if (!event || !entity) {
      console.error('Invalid webhook format - missing event or entity');
      return { success: true, processed: false };
    }
    
    // Find the order by Razorpay order ID
    const orderId = entity['order_id'] as string;
    let order: PaymentOrder | null = null;
    
    try {
      order = await this.getOrder(orderId);
    } catch (error) {
      // Order not found - this might be for a different system
      console.error(`Order not found for webhook: ${orderId}`);
      return { success: true, processed: false };
    }
    
    // Process based on event type
    switch (event) {
      case 'payment.captured':
        return await this.processPaymentCapturedWebhook(entity, order);
      
      case 'payment.failed':
        return await this.processPaymentFailedWebhook(entity, order);
      
      case 'payment.cancelled':
        return await this.processPaymentCancelledWebhook(entity, order);
      
      case 'order.paid':
        return await this.processOrderPaidWebhook(entity, order);
      
      case 'refund.created':
        return await this.processRefundCreatedWebhook(entity);
      
      default:
        console.log(`Unhandled webhook event: ${event}`);
        return { success: true, processed: false };
    }
  }

  private async processPaymentCapturedWebhook(
    entity: Record<string, unknown>,
    order: PaymentOrder,
  ): Promise<{ success: boolean; processed: boolean; order: PaymentOrder }> {
    const paymentId = entity['id'] as string;
    const amount = entity['amount'] as number;
    const currency = entity['currency'] as string;
    const method = entity['method'] as string;
    const bank = entity['bank'] as string;
    
    // Check for duplicate
    const existingTxn = await this.database.query<PaymentTransaction>(
      `SELECT * FROM payment_transactions 
       WHERE order_id = $1 AND transaction_id = $2`,
      [order.id, paymentId],
    );
    
    if (existingTxn.rows.length > 0) {
      console.log(`Duplicate payment webhook for order ${order.orderId}, payment ${paymentId}`);
      return { success: true, processed: false, order };
    }
    
    // Create transaction
    const transactionId = randomUUID();
    await this.database.query(
      `INSERT INTO payment_transactions (
        id, order_id, transaction_id, amount, currency, gateway, method,
        bank_reference, status, webhook_received, webhook_signature, processed_at,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), NOW())`,
      [
        transactionId,
        order.id,
        paymentId,
        amount / 100, // Razorpay amounts are in smallest currency unit (paise for INR)
        currency,
        'razorpay',
        method,
        bank,
        'SUCCESS' as TransactionStatus,
        true,
        null, // Will be set when we have the actual signature
      ],
    );
    
    // Update order
    await this.database.query(
      `UPDATE payment_orders 
       SET payment_id = $1, status = $2, updated_at = NOW()
       WHERE id = $3`,
      [paymentId, 'PAID' as PaymentStatus, order.id],
    );
    
    // Update project status
    if (order.projectId) {
      await this.clientsService.updateClientProject(
        order.clientId,
        order.projectId,
        { status: 'PAID' },
      );
    }
    
    // Record audit event
    await this.recordAuditEvent(
      order.clientId,
      'WEBHOOK_PAYMENT_CAPTURED',
      'SUCCESS',
      { orderId: order.id, paymentId, amount: amount / 100, currency },
    );
    
    // Record payment event
    await this.recordPaymentEvent(
      'payment_captured',
      'payment',
      paymentId,
      order.id,
      null,
      entity,
    );
    
    return { success: true, processed: true, order: { ...order, status: 'PAID', paymentId } };
  }

  private async processPaymentFailedWebhook(
    entity: Record<string, unknown>,
    order: PaymentOrder,
  ): Promise<{ success: boolean; processed: boolean; order: PaymentOrder }> {
    const paymentId = entity['id'] as string;
    const errorCode = entity['error_code'] as string;
    const errorDescription = entity['error_description'] as string;
    
    // Check for duplicate
    const existingTxn = await this.database.query(
      'SELECT * FROM payment_transactions WHERE order_id = $1 AND transaction_id = $2',
      [order.id, paymentId],
    );
    
    if (existingTxn.rows.length > 0) {
      return { success: true, processed: false, order };
    }
    
    // Create failed transaction
    await this.database.query(
      `INSERT INTO payment_transactions (
        id, order_id, transaction_id, amount, currency, gateway,
        status, failure_reason, webhook_received, processed_at,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW(), NOW())`,
      [
        randomUUID(),
        order.id,
        paymentId,
        order.amount,
        order.currency,
        'razorpay',
        'FAILED' as TransactionStatus,
        `${errorCode}: ${errorDescription}`,
        true,
      ],
    );
    
    // Update order status
    await this.database.query(
      `UPDATE payment_orders 
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      ['FAILED' as PaymentStatus, order.id],
    );
    
    // Record audit event
    await this.recordAuditEvent(
      order.clientId,
      'WEBHOOK_PAYMENT_FAILED',
      'SUCCESS',
      { orderId: order.id, paymentId, error: errorDescription },
    );
    
    // Record payment event
    await this.recordPaymentEvent(
      'payment_failed',
      'payment',
      paymentId,
      order.id,
      null,
      entity,
    );
    
    return { success: true, processed: true, order: { ...order, status: 'FAILED' } };
  }

  private async processPaymentCancelledWebhook(
    entity: Record<string, unknown>,
    order: PaymentOrder,
  ): Promise<{ success: boolean; processed: boolean; order: PaymentOrder }> {
    const paymentId = entity['id'] as string;
    
    // Update order status if still in CREATED/PENDING state
    await this.database.query(
      `UPDATE payment_orders 
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND status IN ('CREATED', 'PENDING')`,
      ['CANCELLED' as PaymentStatus, order.id],
    );
    
    // Record audit event
    await this.recordAuditEvent(
      order.clientId,
      'WEBHOOK_PAYMENT_CANCELLED',
      'SUCCESS',
      { orderId: order.id, paymentId },
    );
    
    return { success: true, processed: true, order: { ...order, status: 'CANCELLED' } };
  }

  private async processOrderPaidWebhook(
    entity: Record<string, unknown>,
    order: PaymentOrder,
  ): Promise<{ success: boolean; processed: boolean; order: PaymentOrder }> {
    const paymentId = entity['id'] as string;
    
    // Update order
    await this.database.query(
      `UPDATE payment_orders 
       SET payment_id = $1, status = $2, updated_at = NOW()
       WHERE id = $3 AND status != 'PAID'`,
      [paymentId, 'PAID' as PaymentStatus, order.id],
    );
    
    // Update project status
    if (order.projectId) {
      await this.clientsService.updateClientProject(
        order.clientId,
        order.projectId,
        { status: 'PAID' },
      );
    }
    
    // Record audit event
    await this.recordAuditEvent(
      order.clientId,
      'WEBHOOK_ORDER_PAID',
      'SUCCESS',
      { orderId: order.id, paymentId },
    );
    
    return { success: true, processed: true, order: { ...order, status: 'PAID', paymentId } };
  }

  private async processRefundCreatedWebhook(
    entity: Record<string, unknown>,
  ): Promise<{ success: boolean; processed: boolean }> {
    const refundId = entity['id'] as string;
    const paymentId = entity['payment_id'] as string;
    const amount = entity['amount'] as number;
    
    // Find transaction by payment ID with client info
    const txnResult = await this.database.query<PaymentTransaction & { orderId: string; clientId: string }>(
      `SELECT t.*, o.id AS "orderId", o.client_id AS "clientId"
       FROM payment_transactions t
       JOIN payment_orders o ON o.id = t.order_id
       WHERE t.transaction_id = $1`,
      [paymentId],
    );
    
    if (txnResult.rows.length === 0) {
      console.error(`Transaction not found for refund webhook: ${paymentId}`);
      return { success: true, processed: false };
    }
    
    const txn = txnResult.rows[0];
    const clientId = txnResult.rows[0].clientId;
    
    // Check for duplicate refund
    const existingRefund = await this.database.query(
      'SELECT * FROM payment_refunds WHERE refund_id = $1',
      [refundId],
    );
    
    if (existingRefund.rows.length > 0) {
      return { success: true, processed: false };
    }
    
    // Create refund record
    await this.database.query(
      `INSERT INTO payment_refunds (
        id, transaction_id, refund_id, amount, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [randomUUID(), txn.id, refundId, amount / 100, 'CREATED'],
    );
    
    // Record audit event
    await this.recordAuditEvent(
      clientId,
      'WEBHOOK_REFUND_CREATED',
      'SUCCESS',
      { refundId, paymentId, amount: amount / 100 },
    );
    
    return { success: true, processed: true };
  }

  // ============================================================================
  // Razorpay API Helpers
  // ============================================================================

  private async createRazorpayOrder(
    orderId: string,
    amount: number,
    currency: string,
    notes: string,
  ): Promise<RazorpayOrderResponse> {
    const auth = Buffer.from(`${this.razorpayKeyId}:${this.razorpayKeySecret}`).toString('base64');
    const apiUrl = this.testMode 
      ? 'https://api.razorpay.com/v1/orders' 
      : 'https://api.razorpay.com/v1/orders';
    
    // Convert amount to smallest currency unit (paise for INR)
    const amountInPaise = Math.round(amount * (currency === 'INR' ? 100 : 1));
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        id: orderId,
        amount: amountInPaise,
        currency,
        notes,
        receipt: `receipt_${orderId}`,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Razorpay API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data as RazorpayOrderResponse;
  }

  private async getRazorpayPayment(paymentId: string): Promise<RazorpayPaymentResponse> {
    const auth = Buffer.from(`${this.razorpayKeyId}:${this.razorpayKeySecret}`).toString('base64');
    const apiUrl = `https://api.razorpay.com/v1/payments/${paymentId}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Razorpay API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data as RazorpayPaymentResponse;
  }

  private verifyRazorpaySignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    const crypto = require('crypto');
    const expected = crypto
      .createHmac('sha256', this.razorpayKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    
    return this.timingSafeCompare(expected, signature);
  }

  private generateWebhookSignature(rawBody: string): string {
    const crypto = require('crypto');
    return crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');
  }

  private timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  // ============================================================================
  // Transaction Management
  // ============================================================================

  async getTransaction(transactionId: string): Promise<PaymentTransaction> {
    const result = await this.database.query<PaymentTransaction>(
      `SELECT 
        id, order_id AS "orderId", transaction_id AS "transactionId",
        amount, currency, gateway, method, bank_reference AS "bankReference",
        status, failure_reason AS "failureReason", webhook_received AS "webhookReceived",
        webhook_signature AS "webhookSignature", processed_at AS "processedAt",
        created_at AS "createdAt", updated_at AS "updatedAt"
       FROM payment_transactions 
       WHERE id = $1 OR transaction_id = $1`,
      [transactionId],
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundException(`Transaction not found: ${transactionId}`);
    }
    
    return this.normalizeTransaction(result.rows[0]);
  }

  async getTransactionsByOrder(orderId: string): Promise<PaymentTransaction[]> {
    const result = await this.database.query<PaymentTransaction>(
      `SELECT 
        id, order_id AS "orderId", transaction_id AS "transactionId",
        amount, currency, gateway, method, bank_reference AS "bankReference",
        status, failure_reason AS "failureReason", webhook_received AS "webhookReceived",
        webhook_signature AS "webhookSignature", processed_at AS "processedAt",
        created_at AS "createdAt", updated_at AS "updatedAt"
       FROM payment_transactions 
       WHERE order_id = $1 
       ORDER BY created_at DESC`,
      [orderId],
    );
    
    return result.rows.map(this.normalizeTransaction);
  }

  async getClientPaymentHistory(clientId: string): Promise<Array<{
    order: PaymentOrder;
    transactions: PaymentTransaction[];
  }>> {
    const orders = await this.getOrdersByClient(clientId);
    const history = [];
    
    for (const order of orders) {
      const transactions = await this.getTransactionsByOrder(order.id);
      history.push({ order, transactions });
    }
    
    return history;
  }

  // ============================================================================
  // Refunds
  // ============================================================================

  async createRefund(
    transactionId: string,
    amount: number,
    reason: string,
    userId: string,
  ): Promise<{ success: boolean; refundId: string; amount: number }> {
    // Get transaction
    const txn = await this.getTransaction(transactionId);
    const order = await this.getOrder(txn.orderId);
    
    // Validate amount
    if (amount <= 0) {
      throw new BadRequestException('Refund amount must be positive');
    }
    
    if (amount > txn.amount) {
      throw new BadRequestException('Refund amount cannot exceed transaction amount');
    }
    
    // Check if already refunded
    const existingRefunds = await this.database.query<{ amount: number }>(
      'SELECT SUM(amount)::numeric AS amount FROM payment_refunds WHERE transaction_id = $1',
      [transactionId],
    );
    
    const totalRefunded = Number(existingRefunds.rows[0]?.amount ?? 0);
    if (totalRefunded + amount > txn.amount) {
      throw new BadRequestException('Total refund amount cannot exceed transaction amount');
    }
    
    // Check user permissions
    if (order.clientId !== userId) {
      throw new ForbiddenException('You can only refund your own transactions');
    }
    
    // Create refund via Razorpay if API is configured
    let razorpayRefundId: string | null = null;
    if (this.razorpayKeyId && this.razorpayKeySecret) {
      try {
        const auth = Buffer.from(`${this.razorpayKeyId}:${this.razorpayKeySecret}`).toString('base64');
        const amountInPaise = Math.round(amount * (txn.currency === 'INR' ? 100 : 1));
        
        const response = await fetch(`https://api.razorpay.com/v1/payments/${transactionId}/refund`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
          },
          body: JSON.stringify({
            amount: amountInPaise,
            notes: { reason },
          }),
        });
        
        if (response.ok) {
          const data = await response.json();
          razorpayRefundId = data.id;
        }
      } catch (error) {
        console.error('Failed to create Razorpay refund:', error);
      }
    }
    
    // Create refund record in database
    const refundId = randomUUID();
    await this.database.query(
      `INSERT INTO payment_refunds (
        id, transaction_id, refund_id, amount, reason, status, processed_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [refundId, transactionId, razorpayRefundId, amount, reason, 'CREATED'],
    );
    
    // Record audit event
    await this.recordAuditEvent(
      userId,
      'REFUND_CREATED',
      'SUCCESS',
      { transactionId, amount, reason },
    );
    
    return { 
      success: true, 
      refundId, 
      amount 
    };
  }

  // ============================================================================
  // Payment Events
  // ============================================================================

  private async recordPaymentEvent(
    eventType: string,
    entityType: string,
    entityId: string,
    orderId: string,
    transactionId: string | null,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO payment_events (
          event_type, entity_type, entity_id, order_id, transaction_id,
          payload, processed, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [eventType, entityType, entityId, orderId, transactionId, JSON.stringify(payload), true],
      );
    } catch (error) {
      console.error('Failed to record payment event:', error);
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private normalizeOrder(row: PaymentOrder): PaymentOrder {
    return {
      ...row,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : row.metadata,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
    };
  }

  private normalizeTransaction(row: PaymentTransaction): PaymentTransaction {
    return {
      ...row,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
      processedAt: row.processedAt ? (row.processedAt instanceof Date ? row.processedAt : new Date(row.processedAt)) : null,
    };
  }

  private async recordAuditEvent(
    userId: string,
    action: string,
    result: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.database.query(
        `INSERT INTO audit_log (user_id, action, result, metadata, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, action, result, JSON.stringify(metadata)],
      );
    } catch (error) {
      console.error('Failed to record audit event:', error);
    }
  }
}
