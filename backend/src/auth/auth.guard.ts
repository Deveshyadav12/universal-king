import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { PUBLIC_ROUTE, REQUIRED_ROLE } from './auth.decorators';
import { AuthenticatedUser, UserRole } from '../users/users.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.headers.cookie
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('hexawave_session='))
      ?.slice('hexawave_session='.length);
    if (!token) throw new UnauthorizedException('Sign in to continue.');
    const user = this.authService.verify(token);
    request.user = user;

    const roles = this.reflector.getAllAndOverride<UserRole[]>(REQUIRED_ROLE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length && !roles.includes(user.role)) {
      throw new ForbiddenException('Administrator access is required.');
    }
    return true;
  }
}
