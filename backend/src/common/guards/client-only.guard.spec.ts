import { Test, TestingModule } from '@nestjs/testing';
import { ClientOnlyGuard } from './client-only.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

describe('ClientOnlyGuard', () => {
  let guard: ClientOnlyGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientOnlyGuard,
        Reflector,
      ],
    }).compile();

    guard = module.get<ClientOnlyGuard>(ClientOnlyGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    const createMockContext = (user: { id: string; email: string; name: string; role: string }) => {
      const mockRequest = {
        user,
      };
      
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as unknown as ExecutionContext;
      
      return mockContext;
    };

    it('should allow CLIENT role users', async () => {
      const context = createMockContext({
        id: 'client-1',
        email: 'client@example.com',
        name: 'Test Client',
        role: 'client',
      });

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should reject KING role users with ForbiddenException', async () => {
      const context = createMockContext({
        id: 'king-1',
        email: 'king@example.com',
        name: 'Test King',
        role: 'king',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'This endpoint is only available for clients. Users with role \'king\' are not permitted.',
      );
    });

    it('should reject SUPER_ADMIN role users with ForbiddenException', async () => {
      const context = createMockContext({
        id: 'super-admin-1',
        email: 'superadmin@example.com',
        name: 'Test Super Admin',
        role: 'super_admin',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'This endpoint is only available for clients. Users with role \'super_admin\' are not permitted.',
      );
    });

    it('should reject ADMIN role users with ForbiddenException', async () => {
      const context = createMockContext({
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'admin',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'This endpoint is only available for clients. Users with role \'admin\' are not permitted.',
      );
    });

    it('should reject USER role users with ForbiddenException', async () => {
      const context = createMockContext({
        id: 'user-1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'user',
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        'This endpoint is only available for clients. Users with role \'user\' are not permitted.',
      );
    });

    it('should return true for unauthenticated requests (delegates to AuthGuard)', async () => {
      const context = createMockContext(null as any);
      
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });
});
