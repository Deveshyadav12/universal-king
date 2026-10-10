import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TradingFeatureService } from './trading-feature.service';

const TRADING_FEATURE_CONTROL = 'hexawave:trading-feature-control';

export const TradingFeatureControl = () =>
  SetMetadata(TRADING_FEATURE_CONTROL, true);

@Injectable()
export class TradingFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly feature: TradingFeatureService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isControlRoute = this.reflector.getAllAndOverride<boolean>(
      TRADING_FEATURE_CONTROL,
      [context.getHandler(), context.getClass()],
    );
    if (isControlRoute || this.feature.isEnabled()) return true;
    throw new ServiceUnavailableException(
      'Trading is currently disabled by the King administrator.',
    );
  }
}
