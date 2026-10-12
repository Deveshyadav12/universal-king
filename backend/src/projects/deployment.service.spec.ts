import { BadRequestException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { DeploymentService } from "./deployment.service";

describe("DeploymentService", () => {
  const directories: string[] = [];
  const newStorePath = () => {
    const directory = mkdtempSync(join(tmpdir(), "hexawave-deployments-"));
    directories.push(directory);
    return join(directory, "deployments.json");
  };

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(() => {
    for (const directory of directories) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("encrypts credentials at rest and never returns them from connection status", () => {
    const storePath = newStorePath();
    vi.stubEnv("HEXAWAVE_DEPLOYMENT_STORE", storePath);
    vi.stubEnv("HEXAWAVE_DEPLOYMENT_ENCRYPTION_KEY", "a".repeat(64));
    const service = new DeploymentService();
    const saved = service.saveConnection("project-a", "owner-a", {
      protocol: "ftps",
      host: "hosting.example.com",
      port: 21,
      username: "deploy-user",
      password: "never-store-this-in-plain-text",
      remoteDirectory: "/public_html/site",
    });

    expect(saved).toMatchObject({
      configured: true,
      protocol: "ftps",
      host: "hosting.example.com",
      hasCredentials: true,
    });
    expect(saved).not.toHaveProperty("password");
    expect(saved).not.toHaveProperty("username");
    const serialized = readFileSync(storePath, "utf8");
    expect(serialized).not.toContain("never-store-this-in-plain-text");
    expect(serialized).not.toContain("deploy-user");
    expect(service.getConnection("project-a", "owner-a")).not.toHaveProperty("privateKey");
  });

  it("isolates stored connections by project owner", async () => {
    const storePath = newStorePath();
    vi.stubEnv("HEXAWAVE_DEPLOYMENT_STORE", storePath);
    vi.stubEnv("HEXAWAVE_DEPLOYMENT_ENCRYPTION_KEY", "b".repeat(64));
    const service = new DeploymentService();
    service.saveConnection("project-a", "owner-a", {
      protocol: "ftp",
      host: "hosting.example.com",
      username: "deploy-user",
      password: "test-password",
      remoteDirectory: "public_html",
    });

    expect(service.getConnection("project-a", "owner-b")).toEqual({
      configured: false,
      hasCredentials: false,
    });
    await expect(service.testConnection("project-a", "owner-b")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("requires a fingerprint for SFTP and rejects unsafe remote paths", () => {
    const storePath = newStorePath();
    vi.stubEnv("HEXAWAVE_DEPLOYMENT_STORE", storePath);
    vi.stubEnv("HEXAWAVE_DEPLOYMENT_ENCRYPTION_KEY", "c".repeat(64));
    const service = new DeploymentService();

    expect(() =>
      service.saveConnection("project-sftp", "owner-a", {
        protocol: "sftp",
        host: "hosting.example.com",
        username: "deploy-user",
        password: "test-password",
        remoteDirectory: "/public_html",
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      service.saveConnection("project-ftp", "owner-a", {
        protocol: "ftp",
        host: "hosting.example.com",
        username: "deploy-user",
        password: "test-password",
        remoteDirectory: "/public_html/../private",
      }),
    ).toThrow(BadRequestException);
  });

  it("excludes sensitive/build files and blocks live deployment of an unverified project", () => {
    const storePath = newStorePath();
    vi.stubEnv("HEXAWAVE_DEPLOYMENT_STORE", storePath);
    vi.stubEnv("HEXAWAVE_DEPLOYMENT_ENCRYPTION_KEY", "d".repeat(64));
    vi.stubEnv("NODE_ENV", "development");
    const service = new DeploymentService();
    const preview = service.createPreview(
      "project-a",
      "owner-a",
      { stack: "Static HTML", status: "ready" },
      [
        "index.html",
        "assets/site.css",
        ".env",
        "node_modules/pkg/index.js",
        "../outside.html",
      ],
    );

    expect(preview.files).toEqual(["assets/site.css", "index.html"]);
    expect(preview.excludedFiles).toEqual([".env", "node_modules/pkg/index.js"]);
    expect(preview.compatible).toBe(false);
    expect(preview.blockers).toContain(
      "The project contains a path that cannot be safely deployed.",
    );
    expect(service.getStatus("project-a", "owner-a").status).toBe("Failed");
  });

  it("requires a configured encryption key before accepting secrets", () => {
    const storePath = newStorePath();
    vi.stubEnv("HEXAWAVE_DEPLOYMENT_STORE", storePath);
    vi.stubEnv("HEXAWAVE_DEPLOYMENT_ENCRYPTION_KEY", "");
    const service = new DeploymentService();

    expect(() =>
      service.saveConnection("project-a", "owner-a", {
        protocol: "ftp",
        host: "hosting.example.com",
        username: "deploy-user",
        password: "test-password",
        remoteDirectory: "/public_html",
      }),
    ).toThrow(ServiceUnavailableException);
  });
});
