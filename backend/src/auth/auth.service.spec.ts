import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('HexaWave authentication', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function createServices() {
    const directory = mkdtempSync(join(tmpdir(), 'hexawave-auth-'));
    vi.stubEnv('HEXAWAVE_USER_STORE', join(directory, 'users.json'));
    vi.stubEnv(
      'HEXAWAVE_AUTH_SECRET',
      'local-test-session-signing-secret-0123456789',
    );
    vi.stubEnv('HEXAWAVE_ADMIN_EMAIL', '');
    vi.stubEnv('HEXAWAVE_ADMIN_PASSWORD', '');
    const users = new UsersService();
    users.onModuleInit();
    const auth = new AuthService(users);
    return { auth, directory, users };
  }

  it('registers users with hashed passwords and verifies signed sessions', () => {
    const { auth, directory, users } = createServices();
    try {
      const registration = auth.register(
        'person@example.com',
        'Test Person',
        'a-strong-password',
      );
      const user = registration.user;
      const login = auth.login('PERSON@example.com', 'a-strong-password');
      const storedData = JSON.parse(
        readFileSync(join(directory, 'users.json'), 'utf8'),
      ) as { users: Array<{ passwordHash: string }> };

      expect(user.role).toBe('user');
      expect(storedData.users[0].passwordHash).not.toBe('a-strong-password');
      expect(login.user.id).toBe(user.id);
      expect(auth.verify(login.token)).toEqual(user);
      expect(
        users.authenticate('person@example.com', 'a-strong-password'),
      ).toEqual(user);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects duplicate registration, wrong passwords, and tampered sessions', () => {
    const { auth, directory } = createServices();
    try {
      auth.register('person@example.com', 'Test Person', 'a-strong-password');
      expect(() =>
        auth.register(
          'PERSON@example.com',
          'Another Person',
          'another-password',
        ),
      ).toThrow(ConflictException);
      expect(() =>
        auth.login('person@example.com', 'incorrect-password'),
      ).toThrow(UnauthorizedException);
      const token = auth.login('person@example.com', 'a-strong-password').token;
      expect(() => auth.verify(`${token}tampered`)).toThrow(
        UnauthorizedException,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('bootstraps only the explicitly configured admin identity', () => {
    const directory = mkdtempSync(join(tmpdir(), 'hexawave-admin-'));
    vi.stubEnv('HEXAWAVE_USER_STORE', join(directory, 'users.json'));
    vi.stubEnv(
      'HEXAWAVE_AUTH_SECRET',
      'local-test-session-signing-secret-0123456789',
    );
    vi.stubEnv('HEXAWAVE_ADMIN_EMAIL', 'admin@example.com');
    vi.stubEnv('HEXAWAVE_ADMIN_PASSWORD', 'a-unique-admin-password');
    const users = new UsersService();
    try {
      users.onModuleInit();
      expect(
        users.authenticate('admin@example.com', 'a-unique-admin-password').role,
      ).toBe('admin');
      expect(
        users.authenticate('admin@example.com', 'a-unique-admin-password')
          .email,
      ).toBe('admin@example.com');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('isolates company workspaces and lets CEOs rotate employee invite codes', () => {
    const { auth, directory, users } = createServices();
    try {
      const firstCompany = auth.register(
        'ceo@northstar.example',
        'Northstar CEO',
        'a-strong-password',
        { accountType: 'company', companyName: 'Northstar' },
      );
      const secondCompany = auth.register(
        'ceo@contoso.example',
        'Contoso CEO',
        'another-strong-password',
        { accountType: 'company', companyName: 'Contoso' },
      );

      expect(firstCompany.user.companyRole).toBe('owner');
      expect(firstCompany.companyInviteCode).toMatch(/^[a-f0-9]{48}$/);
      expect(firstCompany.user.workspaceId).not.toBe(secondCompany.user.workspaceId);

      const employee = auth.register(
        'employee@northstar.example',
        'Northstar Employee',
        'employee-strong-password',
        {
          accountType: 'company',
          inviteCode: firstCompany.companyInviteCode,
        },
      );
      expect(employee.user.workspaceId).toBe(firstCompany.user.workspaceId);
      expect(employee.user.companyName).toBe('Northstar');
      expect(employee.user.companyRole).toBe('employee');
      expect(auth.getCompany(firstCompany.user.id)).toEqual({
        id: firstCompany.user.workspaceId,
        name: 'Northstar',
        isOwner: true,
        memberCount: 2,
        employees: [
          {
            name: 'Northstar Employee',
            email: 'employee@northstar.example',
          },
        ],
      });
      expect(auth.getCompany(employee.user.id)).toEqual({
        id: firstCompany.user.workspaceId,
        name: 'Northstar',
        isOwner: false,
        memberCount: 2,
      });

      const rotated = auth.rotateCompanyInvite(firstCompany.user.id);
      expect(rotated.company).toBe('Northstar');
      expect(() =>
        auth.register(
          'old-invite@northstar.example',
          'Old Invite',
          'old-invite-password',
          {
            accountType: 'company',
            inviteCode: firstCompany.companyInviteCode,
          },
        ),
      ).toThrow();
      expect(() =>
        auth.rotateCompanyInvite(employee.user.id),
      ).toThrow();

      const invitedAfterRotation = auth.register(
        'new-employee@northstar.example',
        'New Employee',
        'new-employee-password',
        { accountType: 'company', inviteCode: rotated.inviteCode },
      );
      expect(invitedAfterRotation.user.workspaceId).toBe(firstCompany.user.workspaceId);

      const storedData = JSON.parse(
        readFileSync(join(directory, 'users.json'), 'utf8'),
      ) as { companies: Array<{ inviteCodeHash: string }> };
      expect(storedData.companies[0]?.inviteCodeHash).not.toBe(rotated.inviteCode);
      expect(users.getCompany(secondCompany.user.id)?.memberCount).toBe(1);
      expect(users.getCompany(secondCompany.user.id)?.employees).toEqual([]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps individual registrations in their own private workspaces', () => {
    const { auth, directory } = createServices();
    try {
      const first = auth.register(
        'first@example.com',
        'First Person',
        'a-strong-password',
      ).user;
      const second = auth.register(
        'second@example.com',
        'Second Person',
        'another-strong-password',
      ).user;

      expect(first.accountType).toBe('individual');
      expect(first.workspaceId).not.toBe(second.workspaceId);
      expect(auth.getCompany(first.id)).toBeNull();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
