import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  AccountType,
  AuthenticatedUser,
  UsersService,
} from '../users/users.service';

const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 7;

@Injectable()
export class AuthService {
  private readonly secret = this.loadSecret();

  constructor(private readonly usersService: UsersService) {}

  register(
    email: string,
    name: string,
    password: string,
    options: {
      accountType?: AccountType;
      companyName?: string;
      inviteCode?: string;
    } = {},
  ): Promise<{ user: AuthenticatedUser; companyInviteCode?: string }> {
    return this.usersService.register(email, name, password, options);
  }

  getCompany(userId: string) {
    return this.usersService.getCompany(userId);
  }

  rotateCompanyInvite(userId: string) {
    return this.usersService.rotateCompanyInvite(userId);
  }

  async login(
    email: string,
    password: string,
  ): Promise<{
    user: AuthenticatedUser;
    token: string;
  }> {
    const user = await this.usersService.authenticate(email, password);
    const payload = Buffer.from(
      JSON.stringify({
        sub: user.id,
        exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
      }),
    ).toString('base64url');
    const signature = this.sign(payload);
    return { user, token: `${payload}.${signature}` };
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra) {
      throw new UnauthorizedException('Invalid or expired session.');
    }
    const expected = Buffer.from(this.sign(payload), 'base64url');
    const actual = Buffer.from(signature, 'base64url');
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw new UnauthorizedException('Invalid or expired session.');
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Invalid or expired session.');
    }
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('sub' in decoded) ||
      typeof decoded.sub !== 'string' ||
      !('exp' in decoded) ||
      typeof decoded.exp !== 'number' ||
      decoded.exp <= Math.floor(Date.now() / 1000)
    ) {
      throw new UnauthorizedException('Invalid or expired session.');
    }
    const user = await this.usersService.findById(decoded.sub);
    if (!user) throw new UnauthorizedException('Invalid or expired session.');
    return user;
  }

  getSessionLifetimeSeconds(): number {
    return SESSION_LIFETIME_SECONDS;
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
  }

  private loadSecret(): Buffer {
    const configured = process.env.HEXAWAVE_AUTH_SECRET;
    if (configured) {
      if (configured.length < 32) {
        throw new Error('HEXAWAVE_AUTH_SECRET must be at least 32 characters.');
      }
      return Buffer.from(configured, 'utf8');
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('HEXAWAVE_AUTH_SECRET is required in production.');
    }
    const secretPath = resolve(
      process.env.HEXAWAVE_AUTH_SECRET_FILE ?? 'data/session.key',
    );
    mkdirSync(dirname(secretPath), { recursive: true });
    if (existsSync(secretPath)) return readFileSync(secretPath);
    const secret = randomBytes(48);
    writeFileSync(secretPath, secret, { mode: 0o600, flag: 'wx' });
    return secret;
  }
}
