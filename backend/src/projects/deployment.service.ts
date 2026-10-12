import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { BlockList, isIP } from "node:net";
import { lookup } from "node:dns/promises";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Client as FtpClient } from "basic-ftp";
import SftpClient from "ssh2-sftp-client";

export type DeploymentProtocol = "ftp" | "ftps" | "sftp";
export type DeploymentStatus =
  | "Pending"
  | "Validating"
  | "Connection Tested"
  | "Awaiting Authorization"
  | "Uploading"
  | "Verifying"
  | "Deployed"
  | "Failed";

interface DeploymentSecrets {
  username: string;
  password?: string;
  privateKey?: string;
}

interface EncryptedSecrets {
  iv: string;
  tag: string;
  ciphertext: string;
}

interface StoredConnection {
  ownerId: string;
  protocol: DeploymentProtocol;
  host: string;
  port: number;
  remoteDirectory: string;
  hostKeyFingerprint?: string;
  encryptedSecrets: EncryptedSecrets;
  updatedAt: string;
}

export interface DeploymentLogEntry {
  id: string;
  status: DeploymentStatus;
  message: string;
  timestamp: string;
}

interface DeploymentRecord {
  ownerId: string;
  status: DeploymentStatus;
  firstDeploymentAuthorizedAt: string | null;
  lastConnectionTestAt: string | null;
  preview: DeploymentPreview | null;
  logs: DeploymentLogEntry[];
}

export interface DeploymentPreview {
  compatible: boolean;
  files: string[];
  excludedFiles: string[];
  blockers: string[];
  warnings: string[];
  createdAt: string;
}

export interface PublicDeploymentConnection {
  configured: boolean;
  protocol?: DeploymentProtocol;
  host?: string;
  port?: number;
  remoteDirectory?: string;
  hasCredentials: boolean;
  hostKeyFingerprint?: string;
  updatedAt?: string;
}

interface DeploymentStore {
  connections: Record<string, StoredConnection>;
  deployments: Record<string, DeploymentRecord>;
}

const MAX_HOST_LENGTH = 253;
const MAX_USERNAME_LENGTH = 200;
const MAX_SECRET_LENGTH = 16_384;
const MAX_REMOTE_PATH_LENGTH = 512;
const MAX_PROJECT_FILES = 500;
const SFTP_FINGERPRINT_PATTERN = /^SHA256:[A-Za-z0-9+/]{43}$/;
const BLOCKED_IPV4_SUBNETS: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];
const BLOCKED_IPV6_SUBNETS: Array<[string, number]> = [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
];
const blockedAddresses = new BlockList();
for (const [address, prefix] of BLOCKED_IPV4_SUBNETS) {
  blockedAddresses.addSubnet(address, prefix, "ipv4");
}
for (const [address, prefix] of BLOCKED_IPV6_SUBNETS) {
  blockedAddresses.addSubnet(address, prefix, "ipv6");
}

@Injectable()
export class DeploymentService {
  private readonly storePath = resolve(
    process.env.HEXAWAVE_DEPLOYMENT_STORE ?? "data/project-deployments.json",
  );
  private store: DeploymentStore | null = null;

  getConnection(projectId: string, ownerId: string): PublicDeploymentConnection {
    const connection = this.loadStore().connections[projectId];
    if (!connection || connection.ownerId !== ownerId) {
      return { configured: false, hasCredentials: false };
    }
    return {
      configured: true,
      protocol: connection.protocol,
      host: connection.host,
      port: connection.port,
      remoteDirectory: connection.remoteDirectory,
      hasCredentials: true,
      ...(connection.hostKeyFingerprint
        ? { hostKeyFingerprint: connection.hostKeyFingerprint }
        : {}),
      updatedAt: connection.updatedAt,
    };
  }

  saveConnection(
    projectId: string,
    ownerId: string,
    input: unknown,
  ): PublicDeploymentConnection {
    const validated = this.validateConnectionInput(input);
    const key = this.encryptionKey();
    const store = this.loadStore();
    const encryptedSecrets = this.encrypt(
      key,
      JSON.stringify(validated.secrets),
    );
    store.connections[projectId] = {
      ownerId,
      protocol: validated.protocol,
      host: validated.host,
      port: validated.port,
      remoteDirectory: validated.remoteDirectory,
      ...(validated.hostKeyFingerprint
        ? { hostKeyFingerprint: validated.hostKeyFingerprint }
        : {}),
      encryptedSecrets,
      updatedAt: new Date().toISOString(),
    };
    this.persistStore();
    this.appendLog(projectId, ownerId, "Pending", "Hosting connection saved.");
    return this.getConnection(projectId, ownerId);
  }

  async testConnection(
    projectId: string,
    ownerId: string,
  ): Promise<{ connected: true; checkedAt: string; protocol: DeploymentProtocol }> {
    const connection = this.requireConnection(projectId, ownerId);
    const secrets = this.decryptSecrets(connection);
    const checkedAt = new Date().toISOString();
    this.appendLog(projectId, ownerId, "Validating", "Validating hosting destination.");
    try {
      const addresses = await this.resolvePublicHost(connection.host);
      if (connection.protocol === "sftp") {
        await this.testSftp(connection, secrets, addresses[0].address);
      } else {
        await this.testFtp(connection, secrets, addresses[0].address);
      }
    } catch (error: unknown) {
      this.appendLog(
        projectId,
        ownerId,
        "Failed",
        this.safeConnectionError(error),
      );
      throw new ServiceUnavailableException(this.safeConnectionError(error));
    }

    const record = this.getDeploymentRecord(projectId, ownerId);
    record.lastConnectionTestAt = checkedAt;
    record.status = "Connection Tested";
    this.saveDeploymentRecord(projectId, record);
    this.appendLog(projectId, ownerId, "Connection Tested", "Remote directory is reachable.");
    return { connected: true, checkedAt, protocol: connection.protocol };
  }

  createPreview(
    projectId: string,
    ownerId: string,
    project: { stack: string; status: string },
    fileNames: string[],
  ): DeploymentPreview {
    if (fileNames.length > MAX_PROJECT_FILES) {
      throw new BadRequestException(
        `Deployment preview is limited to ${MAX_PROJECT_FILES} project files.`,
      );
    }

    const record = this.getDeploymentRecord(projectId, ownerId);
    record.status = "Validating";
    this.saveDeploymentRecord(projectId, record);
    this.appendLog(projectId, ownerId, "Validating", "Checking project files and hosting compatibility.");

    const files: string[] = [];
    const excludedFiles: string[] = [];
    const blockers: string[] = [];
    const warnings: string[] = [];
    const stack = project.stack.toLowerCase();
    const isPhpStack = stack.includes("php");
    const isStaticStack =
      stack.includes("static") ||
      stack.includes("html") ||
      stack.includes("css") ||
      stack.includes("javascript");
    if (!isPhpStack && !isStaticStack) {
      blockers.push(
        "This project needs a build/runtime environment that this shared-hosting deployment workflow does not support.",
      );
    }
    if (project.status !== "ready") {
      blockers.push("The project must finish generation and validation before deployment.");
    }
    if (this.isProductionEnvironment()) {
      blockers.push(
        "Automatic deployment is disabled until a secure build sandbox and artifact validation are configured.",
      );
    }

    for (const fileName of fileNames) {
      const safePath = this.safeProjectPath(fileName);
      if (!safePath) {
        blockers.push("The project contains a path that cannot be safely deployed.");
        continue;
      }
      if (this.isExcludedDeploymentFile(safePath)) {
        excludedFiles.push(safePath);
      } else {
        files.push(safePath);
      }
    }
    if (files.length === 0) blockers.push("No deployable website files were found.");
    if (excludedFiles.length > 0) {
      warnings.push(`${excludedFiles.length} secret, development, or generated files were excluded.`);
    }
    if (files.some((file) => file.toLowerCase().endsWith(".php")) && !isPhpStack) {
      blockers.push("PHP files were found, but the project is not configured as a PHP application.");
    }
    if (isPhpStack && !files.some((file) => file.toLowerCase().endsWith(".php"))) {
      blockers.push("The selected PHP project has no deployable PHP entry point.");
    }

    const preview: DeploymentPreview = {
      compatible: blockers.length === 0,
      files: files.sort(),
      excludedFiles: excludedFiles.sort(),
      blockers: [...new Set(blockers)],
      warnings,
      createdAt: new Date().toISOString(),
    };
    record.preview = preview;
    record.status = preview.compatible ? "Awaiting Authorization" : "Failed";
    this.saveDeploymentRecord(projectId, record);
    this.appendLog(
      projectId,
      ownerId,
      record.status,
      preview.compatible
        ? "Deployment preview is ready; client authorization is required before the first live upload."
        : "Deployment preview found blocking issues.",
    );
    return preview;
  }

  authorizeFirstDeployment(
    projectId: string,
    ownerId: string,
  ): { authorized: true; authorizedAt: string } {
    const record = this.getDeploymentRecord(projectId, ownerId);
    if (!record.preview?.compatible) {
      throw new BadRequestException(
        "Generate a compatible deployment preview before authorizing deployment.",
      );
    }
    record.firstDeploymentAuthorizedAt = new Date().toISOString();
    record.status = "Awaiting Authorization";
    this.saveDeploymentRecord(projectId, record);
    this.appendLog(
      projectId,
      ownerId,
      "Awaiting Authorization",
      "Client authorized the first live deployment. A validated artifact is still required.",
    );
    return { authorized: true, authorizedAt: record.firstDeploymentAuthorizedAt };
  }

  requestDeployment(
    projectId: string,
    ownerId: string,
  ): never {
    const record = this.getDeploymentRecord(projectId, ownerId);
    if (!record.firstDeploymentAuthorizedAt) {
      throw new BadRequestException(
        "The client must authorize the first live deployment before deployment can start.",
      );
    }
    if (!record.preview?.compatible) {
      throw new BadRequestException("A compatible deployment preview is required.");
    }
    if (!record.lastConnectionTestAt) {
      throw new BadRequestException("Test the hosting connection before deployment.");
    }

    this.appendLog(projectId, ownerId, "Validating", "Checking deployment safety gates.");
    this.appendLog(
      projectId,
      ownerId,
      "Failed",
      "Live upload is blocked until a secure sandbox and verified deployment artifact pipeline are available.",
    );
    throw new ServiceUnavailableException(
      "Live deployment is disabled until a secure sandbox and verified deployment artifact pipeline are available. No files were uploaded.",
    );
  }

  getStatus(projectId: string, ownerId: string) {
    const record = this.getDeploymentRecord(projectId, ownerId);
    return {
      status: record.status,
      firstDeploymentAuthorized: record.firstDeploymentAuthorizedAt !== null,
      lastConnectionTestAt: record.lastConnectionTestAt,
      preview: record.preview,
      logs: record.logs,
    };
  }

  private async testFtp(
    connection: StoredConnection,
    secrets: DeploymentSecrets,
    pinnedAddress: string,
  ): Promise<void> {
    const client = new FtpClient(12_000);
    try {
      await client.access({
        host: pinnedAddress,
        port: connection.port,
        user: secrets.username,
        password: secrets.password,
        secure: connection.protocol === "ftps",
        ...(connection.protocol === "ftps"
          ? { secureOptions: { servername: connection.host } }
          : {}),
      });
      await client.cd(connection.remoteDirectory);
      await client.list();
    } finally {
      client.close();
    }
  }

  private async testSftp(
    connection: StoredConnection,
    secrets: DeploymentSecrets,
    pinnedAddress: string,
  ): Promise<void> {
    const client = new SftpClient("HexaWave deployment connection test");
    try {
      await client.connect({
        host: pinnedAddress,
        port: connection.port,
        username: secrets.username,
        ...(secrets.password ? { password: secrets.password } : {}),
        ...(secrets.privateKey ? { privateKey: secrets.privateKey } : {}),
        hostHash: "sha256",
        hostVerifier: (fingerprint: string) =>
          fingerprint === connection.hostKeyFingerprint,
        readyTimeout: 12_000,
        keepaliveInterval: 5_000,
        keepaliveCountMax: 2,
      });
      const destination = await client.stat(connection.remoteDirectory);
      if (!destination.isDirectory) {
        throw new Error("Remote destination is not a directory.");
      }
      await client.list(connection.remoteDirectory);
    } finally {
      await client.end().catch(() => false);
    }
  }

  private async resolvePublicHost(
    host: string,
  ): Promise<Array<{ address: string; family: number }>> {
    if (
      host.length > MAX_HOST_LENGTH ||
      /[\s/:?#@%]/.test(host) ||
      host.toLowerCase() === "localhost" ||
      host.toLowerCase().endsWith(".localhost") ||
      host.toLowerCase().endsWith(".local") ||
      host.toLowerCase().endsWith(".internal")
    ) {
      throw new BadRequestException("Use a public hosting hostname or IP address.");
    }

    const addresses = isIP(host)
      ? [{ address: host, family: isIP(host) }]
      : await lookup(host, { all: true, verbatim: true });
    if (
      addresses.length === 0 ||
      addresses.some(({ address, family }) =>
        blockedAddresses.check(address, family === 4 ? "ipv4" : "ipv6"),
      )
    ) {
      throw new BadRequestException("Hosting destination must resolve only to public IP addresses.");
    }
    return addresses;
  }

  private validateConnectionInput(input: unknown): {
    protocol: DeploymentProtocol;
    host: string;
    port: number;
    remoteDirectory: string;
    hostKeyFingerprint?: string;
    secrets: DeploymentSecrets;
  } {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new BadRequestException("Hosting connection settings must be an object.");
    }
    const value = input as Record<string, unknown>;
    if (!["ftp", "ftps", "sftp"].includes(value.protocol as string)) {
      throw new BadRequestException("Protocol must be FTP, FTPS, or SFTP.");
    }
    if (typeof value.host !== "string" || !value.host.trim()) {
      throw new BadRequestException("Hosting host is required.");
    }
    const host = value.host.trim().toLowerCase();
    if (host.length > MAX_HOST_LENGTH || /[\s/:?#@%]/.test(host)) {
      throw new BadRequestException("Hosting host is invalid.");
    }
    const port = value.port === undefined || value.port === ""
      ? value.protocol === "sftp" ? 22 : value.protocol === "ftps" ? 21 : 21
      : Number(value.port);
    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new BadRequestException("Port must be an integer from 1 to 65535.");
    }
    if (
      typeof value.username !== "string" ||
      !value.username.trim() ||
      value.username.length > MAX_USERNAME_LENGTH
    ) {
      throw new BadRequestException("A valid hosting username is required.");
    }
    if (
      typeof value.remoteDirectory !== "string" ||
      !value.remoteDirectory.trim() ||
      value.remoteDirectory.length > MAX_REMOTE_PATH_LENGTH ||
      /[\0-\x1f\x7f\\]/.test(value.remoteDirectory) ||
      value.remoteDirectory.split("/").includes("..")
    ) {
      throw new BadRequestException("Remote directory must be a safe absolute or relative path.");
    }
    const remoteDirectory = value.remoteDirectory.trim();
    const password = typeof value.password === "string" ? value.password : "";
    const privateKey = typeof value.privateKey === "string" ? value.privateKey : "";
    if (password.length > MAX_SECRET_LENGTH || privateKey.length > MAX_SECRET_LENGTH) {
      throw new BadRequestException("Hosting credential exceeds the allowed size.");
    }
    if (value.protocol === "sftp") {
      if (Boolean(password.trim()) === Boolean(privateKey.trim())) {
        throw new BadRequestException("SFTP requires exactly one password or SSH private key.");
      }
      if (
        typeof value.hostKeyFingerprint !== "string" ||
        !SFTP_FINGERPRINT_PATTERN.test(value.hostKeyFingerprint.trim())
      ) {
        throw new BadRequestException(
          "SFTP requires the server's SHA-256 host-key fingerprint to prevent impersonation.",
        );
      }
    } else if (!password.trim() || privateKey.trim()) {
      throw new BadRequestException("FTP and FTPS require a password and do not accept SSH keys.");
    }

    return {
      protocol: value.protocol as DeploymentProtocol,
      host,
      port,
      remoteDirectory,
      ...(value.protocol === "sftp"
        ? { hostKeyFingerprint: (value.hostKeyFingerprint as string).trim() }
        : {}),
      secrets: {
        username: value.username.trim(),
        ...(password ? { password } : {}),
        ...(privateKey ? { privateKey } : {}),
      },
    };
  }

  private requireConnection(projectId: string, ownerId: string): StoredConnection {
    const connection = this.loadStore().connections[projectId];
    if (!connection || connection.ownerId !== ownerId) {
      throw new NotFoundException("Hosting connection is not configured for this project.");
    }
    return connection;
  }

  private decryptSecrets(connection: StoredConnection): DeploymentSecrets {
    const plaintext = this.decrypt(this.encryptionKey(), connection.encryptedSecrets);
    const parsed: unknown = JSON.parse(plaintext);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("username" in parsed) ||
      typeof parsed.username !== "string"
    ) {
      throw new ServiceUnavailableException("Stored hosting credentials are invalid.");
    }
    return parsed as DeploymentSecrets;
  }

  private encryptionKey(): Buffer {
    const configured = process.env.HEXAWAVE_DEPLOYMENT_ENCRYPTION_KEY?.trim();
    if (!configured || !/^[a-f\d]{64}$/i.test(configured)) {
      throw new ServiceUnavailableException(
        "Deployment credential encryption is not configured. Set HEXAWAVE_DEPLOYMENT_ENCRYPTION_KEY to 32 random bytes encoded as 64 hexadecimal characters.",
      );
    }
    return Buffer.from(configured, "hex");
  }

  private encrypt(key: Buffer, plaintext: string): EncryptedSecrets {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    return {
      iv: iv.toString("hex"),
      tag: cipher.getAuthTag().toString("hex"),
      ciphertext: ciphertext.toString("hex"),
    };
  }

  private decrypt(key: Buffer, encrypted: EncryptedSecrets): string {
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(encrypted.iv, "hex"),
      );
      decipher.setAuthTag(Buffer.from(encrypted.tag, "hex"));
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted.ciphertext, "hex")),
        decipher.final(),
      ]).toString("utf8");
    } catch (error: unknown) {
      throw new ServiceUnavailableException(
        "Could not decrypt hosting credentials; verify the server encryption key.",
        { cause: error },
      );
    }
  }

  private getDeploymentRecord(projectId: string, ownerId: string): DeploymentRecord {
    const store = this.loadStore();
    const existing = store.deployments[projectId];
    if (existing && existing.ownerId !== ownerId) {
      throw new NotFoundException("Deployment data is not available for this project.");
    }
    return existing ?? {
      ownerId,
      status: "Pending",
      firstDeploymentAuthorizedAt: null,
      lastConnectionTestAt: null,
      preview: null,
      logs: [],
    };
  }

  private saveDeploymentRecord(projectId: string, record: DeploymentRecord): void {
    this.loadStore().deployments[projectId] = record;
    this.persistStore();
  }

  private appendLog(
    projectId: string,
    ownerId: string,
    status: DeploymentStatus,
    message: string,
  ): void {
    const record = this.getDeploymentRecord(projectId, ownerId);
    record.status = status;
    record.logs.push({
      id: randomUUID(),
      status,
      message: message.slice(0, 240),
      timestamp: new Date().toISOString(),
    });
    record.logs = record.logs.slice(-100);
    this.saveDeploymentRecord(projectId, record);
  }

  private safeProjectPath(input: string): string | null {
    if (
      typeof input !== "string" ||
      !input ||
      input.startsWith("/") ||
      input.includes("\\") ||
      input.includes("\0") ||
      input.split("/").some((part) => part === ".." || part === ".")
    ) {
      return null;
    }
    return input.split("/").filter(Boolean).join("/");
  }

  private isExcludedDeploymentFile(path: string): boolean {
    const parts = path.toLowerCase().split("/");
    const name = parts[parts.length - 1] ?? "";
    const blockedDirectories = new Set([
      ".git",
      ".next",
      ".venv",
      "venv",
      "node_modules",
      "vendor",
      "__pycache__",
      "coverage",
      "tests",
      "test",
      "dist",
      "build",
    ]);
    if (parts.some((part) => blockedDirectories.has(part))) return true;
    if (
      name === ".env" ||
      name.startsWith(".env.") ||
      name.endsWith(".env") ||
      /(^|[-_.])(secret|secrets|credential|credentials|private[-_]?key)([-_.]|$)/i.test(name) ||
      /\.(pem|key|p12|pfx|crt|cer|log|tsbuildinfo)$/i.test(name) ||
      ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock"].includes(name)
    ) {
      return true;
    }
    return false;
  }

  private isProductionEnvironment(): boolean {
    return ["HEXAWAVE_ENV", "NODE_ENV", "APP_ENV"].some(
      (name) => process.env[name]?.trim().toLowerCase() === "production",
    );
  }

  private safeConnectionError(error: unknown): string {
    if (error instanceof BadRequestException) return error.message;
    return "Could not verify the hosting connection or remote directory. Check protocol, host, port, credentials, and destination; server details are hidden.";
  }

  private loadStore(): DeploymentStore {
    if (this.store) return this.store;
    if (!existsSync(this.storePath)) {
      this.store = { connections: {}, deployments: {} };
      return this.store;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(this.storePath, "utf8"));
    } catch (error: unknown) {
      throw new ServiceUnavailableException(
        "Could not read deployment settings.",
        { cause: error },
      );
    }
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("connections" in parsed) ||
      typeof parsed.connections !== "object" ||
      parsed.connections === null ||
      Array.isArray(parsed.connections) ||
      !("deployments" in parsed) ||
      typeof parsed.deployments !== "object" ||
      parsed.deployments === null ||
      Array.isArray(parsed.deployments)
    ) {
      throw new ServiceUnavailableException("Deployment settings store has an invalid format.");
    }
    this.store = parsed as DeploymentStore;
    return this.store;
  }

  private persistStore(): void {
    if (!this.store) throw new Error("Deployment settings store is not initialized.");
    mkdirSync(dirname(this.storePath), { recursive: true });
    const temporaryPath = `${this.storePath}.${randomUUID()}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(this.store, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    renameSync(temporaryPath, this.storePath);
  }
}
