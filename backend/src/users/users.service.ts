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
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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

@Injectable()
export class UsersService implements OnModuleInit {
  private users: StoredUser[] = [];
  private companies: StoredCompany[] = [];
  private inviteCodes = new Map<string, string>();
  private loaded = false;
  private readonly storePath = resolve(
    process.env.HEXAWAVE_USER_STORE ?? 'data/users.json',
  );

  onModuleInit(): void {
    this.load();
    const adminEmail = process.env.HEXAWAVE_ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.HEXAWAVE_ADMIN_PASSWORD;
    if (!adminEmail && !adminPassword) return;
    if (!adminEmail || !adminPassword || adminPassword.length < 12) {
      throw new Error(
        'Configure both HEXAWAVE_ADMIN_EMAIL and a 12-character HEXAWAVE_ADMIN_PASSWORD.',
      );
    }
    const existing = this.users.find((user) => user.email === adminEmail);
    if (existing) {
      if (existing.role !== 'admin') {
        throw new Error(
          'The configured HEXAWAVE_ADMIN_EMAIL belongs to a non-admin account; refusing implicit role escalation.',
        );
      }
      return;
    }
    this.users.push(
      this.makeUser(adminEmail, 'HexaWave Admin', adminPassword, 'admin'),
    );
    this.persist();
  }

  register(
    emailInput: string,
    nameInput: string,
    password: string,
    options: {
      accountType?: AccountType;
      companyName?: string;
      inviteCode?: string;
    } = {},
  ): { user: AuthenticatedUser; companyInviteCode?: string } {
    this.load();
    const email = emailInput.trim().toLowerCase();
    const name = nameInput.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new BadRequestException('Enter a valid email address.');
    }
    if (name.length < 2 || name.length > 100) {
      throw new BadRequestException(
        'Name must be between 2 and 100 characters.',
      );
    }
    if (password.length < 10 || password.length > 128) {
      throw new BadRequestException(
        'Password must be between 10 and 128 characters.',
      );
    }
    if (this.users.some((user) => user.email === email)) {
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
      company = this.findCompanyByInvite(options.inviteCode);
      if (!company) {
        throw new BadRequestException('The company invite code is invalid or expired.');
      }
      companyRole = 'employee';
      companyName = company.name;
      workspaceId = company.id;
    } else {
      companyName = options.companyName?.trim();
      if (!companyName || companyName.length > 120) {
        throw new BadRequestException(
          'Company name must be between 1 and 120 characters.',
        );
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
    if (companyRole === 'owner' && company) {
      company.ownerUserId = user.id;
      this.companies.push(company);
    }
    this.users.push(user);
    this.persist();
    return {
      user: this.publicUser(user),
      ...(companyInviteCode ? { companyInviteCode } : {}),
    };
  }

  authenticate(emailInput: string, password: string): AuthenticatedUser {
    this.load();
    const user = this.users.find(
      (entry) => entry.email === emailInput.trim().toLowerCase(),
    );
    if (!user || !this.passwordMatches(user, password)) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    return this.publicUser(user);
  }

  findById(id: string): AuthenticatedUser | undefined {
    this.load();
    const user = this.users.find((entry) => entry.id === id);
    return user ? this.publicUser(user) : undefined;
  }

  getCompany(userId: string): {
    id: string;
    name: string;
    isOwner: boolean;
    memberCount: number;
    employees?: Array<{ name: string; email: string }>;
  } | null {
    this.load();
    const user = this.users.find((entry) => entry.id === userId);
    if (!user || user.accountType !== 'company') return null;
    const company = this.companies.find(
      (entry) => entry.id === user.workspaceId,
    );
    if (!company) return null;
    const members = this.users.filter(
      (entry) => entry.workspaceId === company.id,
    );
    const isOwner = company.ownerUserId === user.id;
    return {
      id: company.id,
      name: company.name,
      isOwner,
      memberCount: members.length,
      ...(isOwner
        ? {
            employees: members
              .filter((entry) => entry.id !== company.ownerUserId)
              .map((entry) => ({ name: entry.name, email: entry.email })),
          }
        : {}),
    };
  }

  rotateCompanyInvite(userId: string): { company: string; inviteCode: string } {
    this.load();
    const user = this.users.find((entry) => entry.id === userId);
    if (!user || user.accountType !== 'company' || user.companyRole !== 'owner') {
      throw new ForbiddenException(
        'Only the company CEO can manage employee invite codes.',
      );
    }
    const company = this.companies.find(
      (entry) => entry.id === user.workspaceId,
    );
    if (!company) {
      throw new NotFoundException('Company workspace not found.');
    }
    const inviteCode = randomBytes(24).toString('hex');
    company.inviteCodeHash = this.hashInviteCode(inviteCode);
    this.persist();
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

  private passwordMatches(user: StoredUser, password: string): boolean {
    const actual = scryptSync(password, user.salt, 64);
    const expected = Buffer.from(user.passwordHash, 'hex');
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
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

  private load(): void {
    if (this.loaded) return;
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.storePath, 'utf8'));
      if (Array.isArray(parsed)) {
        if (!parsed.every(isStoredUser)) {
          throw new Error('User store has an invalid format.');
        }
        this.users = parsed.map((user) => ({
          ...user,
          accountType: user.accountType ?? 'individual',
          workspaceId: user.workspaceId ?? user.id,
        }));
        this.companies = [];
        this.loaded = true;
        return;
      }
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('User store has an invalid format.');
      }
      const stored = parsed as Partial<StoredUserData>;
      if (
        !Array.isArray(stored.users) ||
        !stored.users.every(isStoredUser) ||
        !Array.isArray(stored.companies) ||
        !stored.companies.every(isStoredCompany)
      ) {
        throw new Error('User store has an invalid format.');
      }
      this.users = stored.users.map((user) => ({
        ...user,
        accountType: user.accountType ?? 'individual',
        workspaceId: user.workspaceId ?? user.id,
      }));
      this.companies = stored.companies;
      this.loaded = true;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        this.loaded = true;
        return;
      }
      throw new Error('Could not load the HexaWave user store.', {
        cause: error,
      });
    }
  }

  private persist(): void {
    mkdirSync(dirname(this.storePath), { recursive: true });
    const temporaryPath = `${this.storePath}.${randomBytes(6).toString('hex')}.tmp`;
    writeFileSync(
      temporaryPath,
      JSON.stringify({ users: this.users, companies: this.companies }, null, 2),
      { encoding: 'utf8', mode: 0o600 },
    );
    renameSync(temporaryPath, this.storePath);
  }

  private findCompanyByInvite(inviteCode: string): StoredCompany | undefined {
    const normalisedCode = inviteCode.trim().toLowerCase();
    if (!/^[a-f0-9]{48}$/.test(normalisedCode)) return undefined;
    const candidateHash = this.hashInviteCode(normalisedCode);
    return this.companies.find((company) => {
      const storedHash = Buffer.from(company.inviteCodeHash, 'hex');
      const suppliedHash = Buffer.from(candidateHash, 'hex');
      return (
        storedHash.length === suppliedHash.length &&
        timingSafeEqual(storedHash, suppliedHash)
      );
    });
  }

  private hashInviteCode(inviteCode: string): string {
    return createHash('sha256').update(inviteCode).digest('hex');
  }
}
