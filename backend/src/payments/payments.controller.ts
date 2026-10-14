import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Roles, CurrentUser } from '../auth/auth.decorators';
import { AuthGuard } from '../auth/auth.guard';
import { ClientOnlyGuard } from '../common/guards/client-only.guard';
import { AuthenticatedUser } from '../users/users.service';
import { PaymentsService } from './payments.service';

@Roles('client', 'admin', 'king', 'super_admin')
@UseGuards(AuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================================================
  // Order Creation
  // ============================================================================

  @Post('orders')
  @UseGuards(ClientOnlyGuard)
  async createOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: {
      projectId?: string;
      amount: number;
      currency?: string;
      notes?: string;
    },
  ) {
    if (!body.amount || body.amount <= 0) {
      throw new BadRequestException('Amount is required and must be positive');
    }
    
    const order = await this.paymentsService.createOrder({
      clientId: user.id,
      projectId: body.projectId,
      amount: body.amount,
      currency: body.currency || 'INR',
      notes: body.notes || `Order created by ${user.name}`,
      metadata: { userId: user.id, userEmail: user.email, userName: user.name },
    });
    
    return { 
      success: true, 
      order: order.order,
      razorpayOrder: order.razorpayOrder,
      // For client-side Razorpay integration
      razorpayConfig: {
        key: this.configService.get<string>('RAZORPAY_KEY_ID') || 'test_key',
        orderId: order.order.orderId,
        amount: order.order.amount,
        currency: order.order.currency,
        name: 'Universal King',
        description: order.order.notes || 'Payment for services',
        prefill: {
          email: user.email,
          name: user.name,
        },
        theme: {
          color: '#3b82f6',
        },
      },
    };
  }

  @Get('orders/:id')
  async getOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const order = await this.paymentsService.getOrder(id);
    
    // Check if user has access to this order
    if (user.role === 'client' && order.clientId !== user.id) {
      throw new BadRequestException('Order not found');
    }
    
    return { success: true, order };
  }

  @Get('me/orders')
  @UseGuards(ClientOnlyGuard)
  async getMyOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const orders = await this.paymentsService.getOrdersByClient(user.id);
    
    // Apply filters
    let filtered = orders;
    if (status) {
      filtered = filtered.filter(o => o.status === status as any);
    }
    
    // Apply pagination
    const limitNum = limit ? Number(limit) : 100;
    const offsetNum = offset ? Number(offset) : 0;
    
    return {
      success: true,
      orders: filtered.slice(offsetNum, offsetNum + limitNum),
      total: filtered.length,
      offset: offsetNum,
      limit: limitNum,
    };
  }

  // ============================================================================
  // Payment Verification
  // ============================================================================

  @Post('verify')
  @UseGuards(ClientOnlyGuard)
  async verifyPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { orderId: string; paymentId: string; signature: string },
  ) {
    // For client verification, we need to check if the order belongs to them
    const order = await this.paymentsService.getOrder(body.orderId);
    if (order.clientId !== user.id) {
      throw new BadRequestException('Order not found');
    }
    
    const result = await this.paymentsService.verifyPayment(
      body.orderId,
      body.paymentId,
      body.signature,
    );
    
    return { 
      success: true, 
      order: result.order,
      transaction: result.transaction,
    };
  }

  // ============================================================================
  // Webhook
  // ============================================================================

  // Webhook doesn't require authentication - it uses signature verification
  @Post('webhook')
  async webhook(
    @Req() req: Request,
    @Body() body: unknown,
  ) {
    // Get raw body for signature verification
    // Note: For raw body access, you need to use a body parser that preserves it
    // For Express, you can use body-parser with { type: '*/*' } or access via req.body
    const rawBody = JSON.stringify(body);
    const signature = (req.headers as any)['x-razorpay-signature'] || '';
    
    if (!signature) {
      throw new BadRequestException('Missing signature');
    }
    
    const result = await this.paymentsService.processWebhook(rawBody, signature);
    
    if (result.success) {
      return { success: true, processed: result.processed, order: result.order };
    }
    
    throw new BadRequestException('Invalid webhook request');
  }

  // ============================================================================
  // Payment History
  // ============================================================================

  @Get('me/history')
  @UseGuards(ClientOnlyGuard)
  async getPaymentHistory(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const history = await this.paymentsService.getClientPaymentHistory(user.id);
    return { success: true, history };
  }

  @Get('orders/:id/transactions')
  async getOrderTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const order = await this.paymentsService.getOrder(id);
    
    // Check if user has access to this order
    if (user.role === 'client' && order.clientId !== user.id) {
      throw new BadRequestException('Order not found');
    }
    
    const transactions = await this.paymentsService.getTransactionsByOrder(order.id);
    return { success: true, transactions };
  }

  // ============================================================================
  // Admin/King - All Orders (for monitoring)
  // ============================================================================

  @Roles('admin', 'king', 'super_admin')
  @Get('admin/orders')
  async getAllOrders(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // This is a placeholder - in a real implementation, we'd query all orders
    // For now, return empty to prevent unauthorized access
    throw new BadRequestException('Admin order listing not implemented in this demo');
  }

  @Roles('admin', 'king', 'super_admin')
  @Get('admin/orders/:id')
  async getAdminOrderDetails(
    @Param('id') id: string,
  ) {
    // Admin/King can access any order
    const order = await this.paymentsService.getOrder(id);
    const transactions = await this.paymentsService.getTransactionsByOrder(order.id);
    
    return { 
      success: true, 
      order,
      transactions,
    };
  }
}
