import { Module } from '@nestjs/common';
import { MarketDataService } from './market-data.service';
import { TradingController } from './trading.controller';
import { TradingFeatureGuard } from './trading-feature.guard';
import { TradingFeatureService } from './trading-feature.service';
import { TradingService } from './trading.service';

@Module({
  controllers: [TradingController],
  providers: [
    MarketDataService,
    TradingFeatureService,
    TradingFeatureGuard,
    TradingService,
  ],
  exports: [TradingService, MarketDataService],
})
export class TradingModule {}
