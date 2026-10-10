import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthModule } from './auth.module';
import { Roles } from './auth.decorators';

@Roles('admin')
@Controller('admin-check')
class AdminOnlyTestController {
  @Get()
  getAdminData() {
    return { access: 'admin' };
  }
}

describe('AuthController and route access', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('registers, persists an HttpOnly session, enforces role gates, and logs out', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'hexawave-auth-api-'));
    vi.stubEnv('HEXAWAVE_USER_STORE', join(directory, 'users.json'));
    vi.stubEnv(
      'HEXAWAVE_AUTH_SECRET',
      'local-test-session-signing-secret-0123456789',
    );
    vi.stubEnv('HEXAWAVE_ADMIN_EMAIL', '');
    vi.stubEnv('HEXAWAVE_ADMIN_PASSWORD', '');
    let app: INestApplication | undefined;
    try {
      const module = await Test.createTestingModule({
        imports: [AuthModule],
        controllers: [AdminOnlyTestController],
      }).compile();
      app = module.createNestApplication();
      app.setGlobalPrefix('api');
      await app.init();

      const registerResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'member@example.com',
          name: 'Workspace Member',
          password: 'a-strong-password',
        })
        .expect(201);
      const setCookie = registerResponse.headers['set-cookie'];
      const sessionCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      if (!sessionCookie)
        throw new Error('Registration did not set a session cookie.');
      expect(sessionCookie).toContain('HttpOnly');
      expect(sessionCookie).toContain('hexawave_session=');

      const meResponse = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', sessionCookie.split(';')[0])
        .expect(200);
      expect(meResponse.body.user.role).toBe('user');
      await request(app.getHttpServer())
        .get('/api/admin-check')
        .set('Cookie', sessionCookie.split(';')[0])
        .expect(403);

      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', sessionCookie.split(';')[0])
        .expect(200);
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    } finally {
      await app?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('creates isolated CEO workspaces and joins employees using rotatable invite codes', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'hexawave-company-api-'));
    vi.stubEnv('HEXAWAVE_USER_STORE', join(directory, 'users.json'));
    vi.stubEnv(
      'HEXAWAVE_AUTH_SECRET',
      'local-test-session-signing-secret-0123456789',
    );
    vi.stubEnv('HEXAWAVE_ADMIN_EMAIL', '');
    vi.stubEnv('HEXAWAVE_ADMIN_PASSWORD', '');
    let app: INestApplication | undefined;
    try {
      const module = await Test.createTestingModule({
        imports: [AuthModule],
      }).compile();
      app = module.createNestApplication();
      app.setGlobalPrefix('api');
      await app.init();

      const ceoResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'ceo@northstar.example',
          name: 'Northstar CEO',
          password: 'a-strong-password',
          accountType: 'company',
          companyName: 'Northstar',
        })
        .expect(201);
      const ceoCookie = ceoResponse.headers['set-cookie'][0].split(';')[0];
      const ceo = ceoResponse.body.user;
      const originalCode = ceoResponse.body.companyInviteCode as string;
      expect(ceo.companyRole).toBe('owner');
      expect(ceo.companyName).toBe('Northstar');
      expect(originalCode).toMatch(/^[a-f0-9]{48}$/);

      const companyResponse = await request(app.getHttpServer())
        .get('/api/auth/company')
        .set('Cookie', ceoCookie)
        .expect(200);
      expect(companyResponse.body.company).toMatchObject({
        name: 'Northstar',
        isOwner: true,
        memberCount: 1,
        employees: [],
      });

      const rotatedResponse = await request(app.getHttpServer())
        .post('/api/auth/company/invite')
        .set('Cookie', ceoCookie)
        .expect(201);
      const rotatedCode = rotatedResponse.body.inviteCode as string;
      expect(rotatedCode).not.toBe(originalCode);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'old-invite@northstar.example',
          name: 'Old Invite',
          password: 'old-invite-password',
          accountType: 'company',
          inviteCode: originalCode,
        })
        .expect(400);

      const employeeResponse = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'employee@northstar.example',
          name: 'Northstar Employee',
          password: 'employee-strong-password',
          accountType: 'company',
          inviteCode: rotatedCode,
        })
        .expect(201);
      expect(employeeResponse.body.user.workspaceId).toBe(ceo.workspaceId);
      expect(employeeResponse.body.user.companyRole).toBe('employee');

      const employeeCookie = employeeResponse.headers['set-cookie'][0].split(';')[0];
      await request(app.getHttpServer())
        .get('/api/auth/company')
        .set('Cookie', employeeCookie)
        .expect(200)
        .expect(({ body }) => {
          expect(body.company).toMatchObject({
            name: 'Northstar',
            isOwner: false,
            memberCount: 2,
          });
          expect(body.company.employees).toBeUndefined();
        });
      await request(app.getHttpServer())
        .post('/api/auth/company/invite')
        .set('Cookie', employeeCookie)
        .expect(403);
    } finally {
      await app?.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
