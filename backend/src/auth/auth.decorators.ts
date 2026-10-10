import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { AuthenticatedUser, UserRole } from '../users/users.service';

export const PUBLIC_ROUTE = 'hexawave:public';
export const REQUIRED_ROLE = 'hexawave:required-role';

export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

export const Roles = (...roles: UserRole[]) =>
  SetMetadata(REQUIRED_ROLE, roles);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);
