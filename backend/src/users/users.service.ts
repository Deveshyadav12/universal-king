import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseService } from '../database/database.service';

export type UserRole = 'admin' | 'user';
export type AccountType = 'individual' | 'company';
export type CompanyRole = 'owner' | 'employee';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  accountType?: AccountType;
  workspaceId?: string;
  companyName?: string;
  companyRole?: CompanyRole;
}

interface StoredUser extends AuthenticatedUser {
  salt: string;
  passwordHash: string;
  createdAt: string;
}

interface StoredCompany {
  id: string;
  name: string;
  ownerUserId: string;
  inviteCodeHash: string;
  createdAt: string;
}

interface StoredUserData {
  users: StoredUser[];
  companies: StoredCompany[];
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  accountType: AccountType;
  workspaceId: string;
  companyName: string | null;
  companyRole: CompanyRole | null;
  salt: string;
  passwordHash: string;
  createdAt: Date | string;
}

interface CompanyRow {
  id: string;
  name: string;
  ownerUserId: string;
  inviteCodeHash: string;
  createdAt: Date | string;
}

function isStoredUser(value: unknown): value is StoredUser {
  if (typeof value !== 'object' || value === null) return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.name === 'string' &&
    (user.role === 'admin' || user.role === 'user') &&
    (user.accountType === undefined ||
      user.accountType === 'individual' ||
      user.accountType === 'company') &&
    (user.workspaceId === undefined || typeof user.workspaceId === 'string') &&
    (user.companyRole === undefined ||
      user.companyRole === 'owner' ||
      user.companyRole === 'employee') &&
    (user.companyName === undefined || typeof user.companyName === 'string') &&
    typeof user.salt === 'string' &&
    typeof user.passwordHash === 'string' &&
    typeof user.createdAt === 'string'
  );
}

function isStoredCompany(value: unknown): value is StoredCompany {
  if (typeof value !== 'object' || value === null) return false;
  const company = value as Record<string, unknown>;
  return (
    typeof company.id === 'string' &&
    typeof company.name === 'string' &&
    typeof company.ownerUserId === 'string' &&
    typeof company.inviteCodeHash === 'string' &&
    typeof company.createdAt === 'string'
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly legacyStorePath = resolve(
    process.env.HEXAWAVE_USER_STORE ?? 'data/users.json',
  );

  constructor(private readonly database: DatabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.importLegacyStore();
    const adminEmail = process.env.HEXAWAVE_ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.HEXAWAVE_ADMIN_PASSWORD;
    if (!adminEmail && !adminPassword) return;
    if (!adminEmail || !adminPassword || adminPassword.length < 12) {
      throw new Error(
        'Configure both HEXAWAVE_ADMIN_EMAIL and a 12-character HEXAWAVE_ADMIN_PASSWORD.',
      );
    }

    const result = await this.database.query<{ role: UserRole }>(
      'SELECT role FROM users WHERE email = $1',
      [adminEmail],
    );
    if (result.rows[0]) {
      if (result.rows[0].role !== 'admin') {
        throw new Error(
          'The configured HEXAWAVE_ADMIN_EMAIL belongs to a non-admin account; refusing implicit role escalation.',
        );
      }
      return;
    }
    const admin = this.makeUser(adminEmail, 'HexaWave Admin', adminPassword, 'admin');
    await this.insertUser(admin);
  }

  async register(
    emailInput: string,
    nameInput: string,
    password: string,
    options: {
      accountType?: AccountType;
      companyName?: string;
      inviteCode?: string;
    } = {},
  ): Promise<{ user: AuthenticatedUser; companyInviteCode?: string }> {
    const email = emailInput.trim().toLowerCase();
    const name = nameInput.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new BadRequestException('Enter a valid email address.');
    }
    if (name.length < 2 || name.length > 100) {
      throw new BadRequestException('Name must be between 2 and 100 characters.');
    }
    if (password.length < 10 || password.length > 128) {
      throw new BadRequestException('Password must be between 10 and 128 characters.');
    }
    if ((await this.database.query('SELECT 1 FROM users WHERE email = $1', [email])).rowCount) {
      throw new ConflictException('An account with this email already exists.');
    }

    const accountType = options.accountType ?? 'individual';
    if (accountType !== 'individual' && accountType !== 'company') {
      throw new BadRequestException('Choose an individual or company account.');
    }
    let company: StoredCompany | undefined;
    let companyRole: CompanyRole | undefined;
    let companyName: string | undefined;
    let workspaceId: string = randomUUID();
    let companyInviteCode: string | undefined;

    if (accountType === 'individual') {
      if (options.companyName !== undefined || options.inviteCode !== undefined) {
        throw new BadRequestException(
          'Company details require a company account registration.',
        );
      }
    } else if (options.inviteCode !== undefined) {
      if (options.companyName !== undefined) {
        throw new BadRequestException(
          'Use either a company name or an employee invite code.',
        );
      }
      company = await this.findCompanyByInvite(options.inviteCode);
      if (!company) {
        throw new BadRequestException('The company invite code is invalid or expired.');
      }
      companyRole = 'employee';
      companyName = company.name;
      workspaceId = company.id;
    } else {
      companyName = options.companyName?.trim();
      if (!companyName || companyName.length > 120) {
        throw new BadRequestException('Company name must be between 1 and 120 characters.');
      }
      workspaceId = randomUUID();
      companyRole = 'owner';
      companyInviteCode = randomBytes(24).toString('hex');
      company = {
        id: workspaceId,
        name: companyName,
        ownerUserId: '',
        inviteCodeHash: this.hashInviteCode(companyInviteCode),
        createdAt: new Date().toISOString(),
      };
    }

    const user = this.makeUser(email, name, password, 'user', {
      accountType,
      workspaceId,
      ...(companyName ? { companyName } : {}),
      ...(companyRole ? { companyRole } : {}),
    });
    try {
      await this.database.transaction(async (client) => {
        await client.query(
          `INSERT INTO users
            (id, email, name, role, account_type, workspace_id, company_name,
             company_role, password_salt, password_hash, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          this.userValues(user),
        );
        if (companyRole === 'owner' && company) {
          company.ownerUserId = user.id;
          await client.query(
            `INSERT INTO companies (id, name, owner_user_id, invite_code_hash, created_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              company.id,
              company.name,
              company.ownerUserId,
              company.inviteCodeHash,
              company.createdAt,
            ],
          );
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    }

    return {
      user: this.publicUser(user),
      ...(companyInviteCode ? { companyInviteCode } : {}),
    };
  }

  async authenticate(emailInput: string, password: string): Promise<AuthenticatedUser> {
    const result = await this.database.query<UserRow>(
      `SELECT id, email, name, role, account_type AS "accountType",
              workspace_id AS "workspaceId", company_name AS "companyName",
              company_role AS "companyRole", password_salt AS salt,
              password_hash AS "passwordHash", created_at AS "createdAt"
       FROM users WHERE email = $1`,
      [emailInput.trim().toLowerCase()],
    );
    const row = result.rows[0];
    if (!row || !this.passwordMatches(this.toStoredUser(row), password)) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    return this.publicUser(this.toStoredUser(row));
  }

  async findById(id: string): Promise<AuthenticatedUser | undefined> {
    const result = await this.database.query<UserRow>(
      `SELECT id, email, name, role, account_type AS "accountType",
              workspace_id AS "workspaceId", company_name AS "companyName",
              company_role AS "companyRole", password_salt AS salt,
              password_hash AS "passwordHash", created_at AS "createdAt"
       FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0]
      ? this.publicUser(this.toStoredUser(result.rows[0]))
      : undefined;
  }

  async getCompany(userId: string): Promise<{
    id: string;
    name: string;
    isOwner: boolean;
    memberCount: number;
    employees?: Array<{ name: string; email: string }>;
  } | null> {
    const userResult = await this.database.query<Pick<UserRow, 'id' | 'accountType' | 'workspaceId'>>(
      `SELECT id, account_type AS "accountType", workspace_id AS "workspaceId"
       FROM users WHERE id = $1`,
      [userId],
    );
    const user = userResult.rows[0];
    if (!user || user.accountType !== 'company') return null;

    const companyResult = await this.database.query<CompanyRow>(
      `SELECT id, name, owner_user_id AS "ownerUserId",
              invite_code_hash AS "inviteCodeHash", created_at AS "createdAt"
       FROM companies WHERE id = $1`,
      [user.workspaceId],
    );
    const company = companyResult.rows[0];
    if (!company) return null;
    const isOwner = company.ownerUserId === user.id;
    const members = await this.database.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM users WHERE workspace_id = $1',
      [company.id],
    );
    const response = {
      id: company.id,
      name: company.name,
      isOwner,
      memberCount: Number(members.rows[0]?.count ?? 0),
    };
    if (!isOwner) return response;
    const employees = await this.database.query<{ name: string; email: string }>(
      `SELECT name, email FROM users
       WHERE workspace_id = $1 AND id <> $2 ORDER BY created_at, id`,
      [company.id, company.ownerUserId],
    );
    return { ...response, employees: employees.rows };
  }

  async rotateCompanyInvite(
    userId: string,
  ): Promise<{ company: string; inviteCode: string }> {
    const result = await this.database.query<{
      id: string;
      name: string;
      companyRole: CompanyRole | null;
    }>(
      `SELECT c.id, c.name, u.company_role AS "companyRole"
       FROM users u JOIN companies c ON c.id = u.workspace_id
       WHERE u.id = $1 AND u.account_type = 'company'`,
      [userId],
    );
    const company = result.rows[0];
    if (!company || company.companyRole !== 'owner') {
      throw new ForbiddenException(
        'Only the company CEO can manage employee invite codes.',
      );
    }
    const inviteCode = randomBytes(24).toString('hex');
    await this.database.query(
      'UPDATE companies SET invite_code_hash = $1 WHERE id = $2',
      [this.hashInviteCode(inviteCode), company.id],
    );
    return { company: company.name, inviteCode };
  }

  private makeUser(
    email: string,
    name: string,
    password: string,
    role: UserRole,
    workspace: {
      accountType?: AccountType;
      workspaceId?: string;
      companyName?: string;
      companyRole?: CompanyRole;
    } = {},
  ): StoredUser {
    const salt = randomBytes(16).toString('hex');
    return {
      id: randomBytes(16).toString('hex'),
      email,
      name,
      role,
      accountType: workspace.accountType ?? 'individual',
      workspaceId: workspace.workspaceId ?? randomUUID(),
      ...(workspace.companyName ? { companyName: workspace.companyName } : {}),
      ...(workspace.companyRole ? { companyRole: workspace.companyRole } : {}),
      salt,
      passwordHash: scryptSync(password, salt, 64).toString('hex'),
      createdAt: new Date().toISOString(),
    };
  }

  private async insertUser(user: StoredUser): Promise<void> {
    await this.database.query(
      `INSERT INTO users
        (id, email, name, role, account_type, workspace_id, company_name,
         company_role, password_salt, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      this.userValues(user),
    );
  }

  private userValues(user: StoredUser): unknown[] {
    return [
      user.id,
      user.email,
      user.name,
      user.role,
      user.accountType ?? 'individual',
      user.workspaceId ?? user.id,
      user.companyName ?? null,
      user.companyRole ?? null,
      user.salt,
      user.passwordHash,
      user.createdAt,
    ];
  }

  private toStoredUser(row: UserRow): StoredUser {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      accountType: row.accountType,
      workspaceId: row.workspaceId,
      ...(row.companyName ? { companyName: row.companyName } : {}),
      ...(row.companyRole ? { companyRole: row.companyRole } : {}),
      salt: row.salt,
      passwordHash: row.passwordHash,
      createdAt:
        row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    };
  }

  private passwordMatches(user: StoredUser, password: string): boolean {
    const actual = scryptSync(password, user.salt, 64);
    const expected = Buffer.from(user.passwordHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private publicUser(user: StoredUser): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accountType: user.accountType ?? 'individual',
      workspaceId: user.workspaceId ?? user.id,
      ...(user.companyName ? { companyName: user.companyName } : {}),
      ...(user.companyRole ? { companyRole: user.companyRole } : {}),
    };
  }

  private async importLegacyStore(): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.legacyStorePath, 'utf8'));
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return;
      }
      throw new Error('Could not read the legacy HexaWave user store.', {
        cause: error,
      });
    }

    let users: StoredUser[];
    let companies: StoredCompany[];
    if (Array.isArray(parsed)) {
      users = parsed.filter(isStoredUser);
      companies = [];
      if (users.length !== parsed.length) {
        throw new Error('Legacy user store has an invalid format.');
      }
    } else if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'users' in parsed &&
      'companies' in parsed &&
      Array.isArray(parsed.users) &&
      Array.isArray(parsed.companies) &&
      parsed.users.every(isStoredUser) &&
      parsed.companies.every(isStoredCompany)
    ) {
      users = parsed.users;
      companies = parsed.companies;
    } else {
      throw new Error('Legacy user store has an invalid format.');
    }

    if (users.length === 0 && companies.length === 0) return;
    await this.database.transaction(async (client) => {
      const count = await client.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM users',
      );
      if (Number(count.rows[0]?.count ?? 0) > 0) return;
      for (const user of users) {
        const normalized = {
          ...user,
          accountType: user.accountType ?? 'individual',
          workspaceId: user.workspaceId ?? user.id,
        };
        await client.query(
          `INSERT INTO users
            (id, email, name, role, account_type, workspace_id, company_name,
             company_role, password_salt, password_hash, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          this.userValues(normalized),
        );
      }
      for (const company of companies) {
        await client.query(
          `INSERT INTO companies (id, name, owner_user_id, invite_code_hash, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            company.id,
            company.name,
            company.ownerUserId,
            company.inviteCodeHash,
            company.createdAt,
          ],
        );
      }
    });
  }

  private async findCompanyByInvite(inviteCode: string): Promise<StoredCompany | undefined> {
    const normalisedCode = inviteCode.trim().toLowerCase();
    if (!/^[a-f0-9]{48}$/.test(normalisedCode)) return undefined;
    const result = await this.database.query<CompanyRow>(
      `SELECT id, name, owner_user_id AS "ownerUserId",
              invite_code_hash AS "inviteCodeHash", created_at AS "createdAt"
       FROM companies WHERE invite_code_hash = $1`,
      [this.hashInviteCode(normalisedCode)],
    );
    const company = result.rows[0];
    if (!company) return undefined;
    return {
      ...company,
      createdAt:
        company.createdAt instanceof Date
          ? company.createdAt.toISOString()
          : company.createdAt,
    };
  }

  private hashInviteCode(inviteCode: string): string {
    return createHash('sha256').update(inviteCode).digest('hex');
  }
}
