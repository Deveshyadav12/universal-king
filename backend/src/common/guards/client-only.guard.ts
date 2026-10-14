import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthenticatedUser } from '../../users/users.service';

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Guard to ensure only CLIENT role users can access certain endpoints.
 * This explicitly rejects KING, SUPER_ADMIN, ADMIN, and USER roles.
 */
@Injectable()
export class ClientOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      // Let AuthGuard handle unauthenticated requests
      return true;
    }

    // Only CLIENT role is allowed
    if (user.role !== 'client') {
      throw new ForbiddenException(
        `This endpoint is only available for clients. Users with role '${user.role}' are not permitted.`,
      );
    }

    return true;
  }
}
