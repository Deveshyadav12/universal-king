import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public, Roles } from '../auth/auth.decorators';
import { MarketDataService } from './market-data.service';
import { TradingService } from './trading.service';
import type { CreateStrategyInput, UpdateStrategyInput } from './trading.types';
import {
  TradingFeatureControl,
  TradingFeatureGuard,
} from './trading-feature.guard';
import { TradingFeatureService } from './trading-feature.service';

/**
 * Admin-only API for the baseline trading automation.
 *
 * The global AuthGuard protects every route; `@Roles("admin")` restricts the
 * whole controller to administrators.
 */
@Roles('admin')
@UseGuards(TradingFeatureGuard)
@Controller('trading')
export class TradingController {
  constructor(
    private readonly tradingService: TradingService,
    private readonly marketDataService: MarketDataService,
    private readonly tradingFeature: TradingFeatureService,
  ) {}

  @Public()
  @TradingFeatureControl()
  @Get('availability')
  availability() {
    return { enabled: this.tradingFeature.isEnabled() };
  }

  @TradingFeatureControl()
  @Patch('availability')
  setAvailability(@Body() body: { enabled?: unknown }) {
    if (typeof body?.enabled !== 'boolean') {
      throw new BadRequestException('enabled must be a boolean.');
    }
    const result = this.tradingFeature.setEnabled(body.enabled);
    if (!result.enabled) this.tradingService.disableAutomation();
    return result;
  }

  @Get('overview')
  overview() {
    return this.tradingService.overview();
  }

  @Get('provider')
  provider() {
    return this.marketDataService.status();
  }

  @Get('quotes')
  quotes() {
    return this.marketDataService.allQuotes();
  }

  @Get('history/:symbol')
  history(@Param('symbol') symbol: string) {
    return this.marketDataService.priceHistory(symbol);
  }

  @Get('strategies')
  listStrategies() {
    return this.tradingService.listStrategies();
  }

  @Post('strategies')
  createStrategy(@Body() body: CreateStrategyInput) {
    return this.tradingService.createStrategy(body);
  }

  @Get('strategies/:id')
  getStrategy(@Param('id') id: string) {
    return this.tradingService.getStrategy(id);
  }

  @Patch('strategies/:id')
  updateStrategy(@Param('id') id: string, @Body() body: UpdateStrategyInput) {
    return this.tradingService.updateStrategy(id, body);
  }

  @Delete('strategies/:id')
  removeStrategy(@Param('id') id: string) {
    return this.tradingService.removeStrategy(id);
  }

  @Post('strategies/:id/start')
  startStrategy(@Param('id') id: string) {
    return this.tradingService.startStrategy(id);
  }

  @Post('strategies/:id/pause')
  pauseStrategy(@Param('id') id: string) {
    return this.tradingService.pauseStrategy(id);
  }

  @Post('strategies/:id/stop')
  stopStrategy(@Param('id') id: string) {
    return this.tradingService.stopStrategy(id);
  }

  @Post('strategies/:id/arm')
  setArmed(@Param('id') id: string, @Body() body: { armed?: unknown }) {
    return this.tradingService.setArmed(id, body?.armed === true);
  }

  @Post('strategies/:id/baseline/current')
  adoptCurrentBaseline(@Param('id') id: string) {
    return this.tradingService.adoptCurrentPriceAsBaseline(id);
  }

  @Post('strategies/:id/evaluate')
  evaluateOnce(@Param('id') id: string) {
    return this.tradingService.evaluateOnce(id);
  }

  @Get('strategies/:id/performance')
  performance(@Param('id') id: string) {
    return this.tradingService.getPerformance(id);
  }

  @Get('signals')
  signals(@Query('limit') limit?: string) {
    return this.tradingService.listSignals(this.parseLimit(limit));
  }

  @Get('orders')
  orders(@Query('limit') limit?: string) {
    return this.tradingService.listOrders(this.parseLimit(limit));
  }

  @Get('positions')
  positions() {
    return this.tradingService.listPositions();
  }

  @Get('audit')
  audit(@Query('limit') limit?: string) {
    return this.tradingService.audit(this.parseLimit(limit));
  }

  @Post('tick')
  runTick() {
    return this.tradingService.runTick();
  }

  private parseLimit(limit?: string): number {
    if (limit === undefined) return 100;
    const parsed = Number(limit);
    return Number.isFinite(parsed) ? parsed : 100;
  }
}
