import type {
  CrmStats,
  DiscoveryTargets,
  EmailIntegrationStatus,
  Lead,
  LeadDiscoveryResult,
  LeadDiscoveryStatus,
  LeadStatus,
} from "@/src/types/crm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type ProjectStatus =
  | "created"
  | "planning"
  | "architecting"
  | "coding"
  | "testing"
  | "building"
  | "fixing"
  | "ready"
  | "failed"
  | "running"
  | "stopped";

export interface ProjectFile {
  name: string;
  language: string;
  content: string;
}

export interface ProjectProcess {
  pid: number;
  port: number;
  status: string;
  startedAt: string;
}

export interface ProjectStatusResponse {
  success: boolean;
  status: ProjectStatus;
  process: ProjectProcess | null;
  output: string;
  project?: {
    id: string;
    status: ProjectStatus;
    process: ProjectProcess | null;
  };
}

export interface ProjectGenerationResponse {
  success: boolean;
  projectId: string;
  status: ProjectStatus;
  generationMode?: "fast" | "full";
  files: ProjectFile[];
  build?: {
    passed: boolean;
    attempts: number;
    errors: string[];
    stage: string;
    stdout?: string;
    stderr?: string;
  };
}

export interface ProjectActionResponse {
  success: boolean;
  status?: ProjectStatus;
  message?: string;
  pid?: number;
  port?: number;
  url?: string;
  stdout?: string;
  stderr?: string;
  attempts?: number;
  build?: {
    passed: boolean;
    errors?: string[];
    stdout?: string;
    stderr?: string;
  };
}

export interface AiHealthResponse {
  success: boolean;
  service: string;
  status: "online";
  version: string;
  workspaces: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  type: string;
  stack: string;
  description: string;
  status: ProjectStatus;
  process: ProjectProcess | null;
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  accountType?: "individual" | "company";
  workspaceId?: string;
  companyName?: string;
  companyRole?: "owner" | "employee";
}

export interface CompanyProfile {
  id: string;
  name: string;
  isOwner: boolean;
  memberCount: number;
  employees?: Array<{
    name: string;
    email: string;
  }>;
}

export interface RegistrationResult {
  user: AuthUser;
  companyInviteCode?: string;
}

export interface BillingCatalog {
  checkoutAvailable: boolean;
  softwareRequest: { amountPaise: number; currency: "INR" } | null;
  plans: Array<{
    id: "pro" | "team" | "enterprise";
    enabled: boolean;
    amountPaise: number | null;
    interval: "monthly" | "yearly";
  }>;
  creditPacks: Array<{
    id: string;
    label: string;
    credits: number;
    amountPaise: number;
    currency: "INR";
  }>;
}

export interface BillingAdminConfiguration {
  checkoutEnabled: boolean;
  softwareRequestAmountPaise: number | null;
  creditsPerAiAction: number;
  plans: Record<
    "pro" | "team" | "enterprise",
    {
      enabled: boolean;
      amountPaise: number | null;
      interval: "monthly" | "yearly";
      razorpayPlanId: string;
    }
  >;
  creditPacks: Array<{
    id: string;
    label: string;
    credits: number;
    amountPaise: number;
  }>;
  provider: {
    credentialsConfigured: boolean;
    webhookConfigured: boolean;
    mode: "test" | "live" | "unconfigured";
    livePaymentsEnabled: boolean;
    productionCheckoutSupported: boolean;
  };
}

export interface BillingCheckout {
  paymentIntentId: string;
  kind: "subscription" | "software-request" | "credits";
  amountPaise: number;
  currency: "INR";
  keyId: string;
  orderId?: string;
  subscriptionId?: string;
}

export interface RazorpayPaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_subscription_id?: string;
  razorpay_signature: string;
}

export interface MaintenanceImportResponse {
  success: boolean;
  project: ProjectSummary;
  files: string[];
  message: string;
}

async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new Error(`Could not reach HexaWave backend: ${message}`);
  }

  if (!response.ok) {
    const body = await response.text();
    let detail = body || response.statusText;
    try {
      const parsed: unknown = JSON.parse(body);
      if (
        parsed &&
        typeof parsed === "object" &&
        "message" in parsed &&
        typeof parsed.message === "string"
      ) {
        detail = parsed.message;
      } else if (
        parsed &&
        typeof parsed === "object" &&
        "detail" in parsed
      ) {
        detail = typeof parsed.detail === "string"
          ? parsed.detail
          : JSON.stringify(parsed.detail);
      }
    } catch {
      // The response body is already retained as the useful error detail.
    }
    throw new Error(`Request failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as T;
}

export async function register(
  data: {
    email: string;
    name: string;
    password: string;
    accountType?: "individual" | "company";
    companyName?: string;
    inviteCode?: string;
  },
): Promise<RegistrationResult> {
  const result = await apiRequest<{
    success: boolean;
    user: AuthUser;
    companyInviteCode?: string;
  }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return { user: result.user, companyInviteCode: result.companyInviteCode };
}

export async function login(data: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const result = await apiRequest<{ success: boolean; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return result.user;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const result = await apiRequest<{ success: boolean; user: AuthUser }>("/auth/me");
  return result.user;
}

export async function getCompanyProfile(): Promise<CompanyProfile | null> {
  const result = await apiRequest<{
    success: boolean;
    company: CompanyProfile | null;
  }>("/auth/company");
  return result.company;
}

export async function rotateCompanyInvite(): Promise<{
  company: string;
  inviteCode: string;
}> {
  return apiRequest("/auth/company/invite", { method: "POST" });
}

export async function logout(): Promise<void> {
  await apiRequest<{ success: boolean }>("/auth/logout", { method: "POST" });
}

export async function getAiHealth(): Promise<AiHealthResponse> {
  return apiRequest("/ai/health");
}

export interface TradingAvailability {
  enabled: boolean;
}

export async function getTradingAvailability(): Promise<TradingAvailability> {
  return apiRequest("/trading/availability");
}

export async function setTradingAvailability(
  enabled: boolean,
): Promise<TradingAvailability> {
  return apiRequest("/trading/availability", {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export async function getCrmStats(): Promise<CrmStats> {
  return apiRequest("/crm/stats");
}

export async function getLeads(status?: LeadStatus): Promise<Lead[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest(`/leads${query}`);
}

export async function createLead(data: {
  companyName: string;
  contactName?: string;
  jobTitle?: string;
  email?: string;
  industry?: string;
  website?: string;
}): Promise<Lead> {
  return apiRequest("/leads", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function scoreLead(id: string): Promise<Lead> {
  return apiRequest(`/leads/${encodeURIComponent(id)}/score`, {
    method: "POST",
  });
}

export async function suppressLead(id: string, reason = "manual"): Promise<Lead> {
  return apiRequest(`/leads/${encodeURIComponent(id)}/suppress`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function getEmailIntegrationStatus(): Promise<EmailIntegrationStatus> {
  return apiRequest("/email/cloudflare/status");
}

export async function getLeadDiscoveryStatus(): Promise<LeadDiscoveryStatus> {
  return apiRequest("/leads/discovery/status");
}

export async function runLeadDiscovery(
  targets?: Partial<DiscoveryTargets>,
): Promise<LeadDiscoveryResult> {
  return apiRequest("/leads/discovery/run", {
    method: "POST",
    body: JSON.stringify(targets ?? {}),
  });
}

export async function stopLeadDiscovery(): Promise<{ success: boolean; status: "stopping" }> {
  return apiRequest("/leads/discovery/stop", { method: "POST" });
}

export async function setLeadDiscoverySchedule(
  enabled: boolean,
  targets?: Partial<DiscoveryTargets>,
): Promise<LeadDiscoveryStatus> {
  return apiRequest("/leads/discovery/schedule", {
    method: "PATCH",
    body: JSON.stringify({ enabled, targets }),
  });
}

export async function getProjects(): Promise<ProjectSummary[]> {
  const result = await apiRequest<{
    success: boolean;
    projects: ProjectSummary[];
  }>("/projects");
  return result.projects;
}

export async function createProject(data: {
  name: string;
  type: string;
  stack: string;
  description: string;
}): Promise<{ success: boolean; project: { id: string } }> {
  return apiRequest("/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function importMaintenanceZip(data: {
  projectName: string;
  archiveBase64: string;
}): Promise<MaintenanceImportResponse> {
  return apiRequest("/projects/maintenance/import", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function importPublicGithubRepository(
  repositoryUrl: string,
): Promise<MaintenanceImportResponse> {
  return apiRequest("/projects/maintenance/import-github", {
    method: "POST",
    body: JSON.stringify({ repositoryUrl }),
  });
}

export async function generateProject(
  data: {
    projectName: string;
    projectType: string;
    stack: string;
    prompt: string;
    generationMode?: "fast" | "full";
  },
  projectId?: string,
): Promise<ProjectGenerationResponse> {
  const route = projectId
    ? `/projects/${encodeURIComponent(projectId)}/generate`
    : "/ai/generate";
  return apiRequest(route, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getProjectStatus(projectId: string): Promise<ProjectStatusResponse> {
  return apiRequest(`/projects/${encodeURIComponent(projectId)}/status`);
}

export async function getProjectFiles(projectId: string): Promise<string[]> {
  const result = await apiRequest<{
    success: boolean;
    files: string[];
  }>(`/projects/${encodeURIComponent(projectId)}/files`);
  return result.files;
}

export async function getProjectFile(
  projectId: string,
  filePath: string,
): Promise<ProjectFile> {
  const encodedPath = encodeURIComponent(filePath);
  const result = await apiRequest<{ path: string; content: string }>(
    `/projects/${encodeURIComponent(projectId)}/files/${encodedPath}`,
  );
  return {
    name: result.path,
    language: getFileLanguage(result.path),
    content: result.content,
  };
}

export async function updateProjectFile(
  projectId: string,
  filePath: string,
  content: string,
): Promise<void> {
  const encodedPath = encodeURIComponent(filePath);
  await apiRequest(`/projects/${encodeURIComponent(projectId)}/files/${encodedPath}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export async function editProjectFileWithAi(
  projectId: string,
  filePath: string,
  instruction: string,
): Promise<ProjectFile> {
  const result = await apiRequest<{
    success: boolean;
    path: string;
    content: string;
  }>(`/projects/${encodeURIComponent(projectId)}/ai-edit`, {
    method: "POST",
    body: JSON.stringify({ filePath, instruction }),
  });
  return {
    name: result.path,
    language: getFileLanguage(result.path),
    content: result.content,
  };
}

export async function maintainProjectWithAi(
  projectId: string,
  instruction: string,
): Promise<{
  summary: string;
  changedFiles: string[];
  excludedFileCount: number;
}> {
  return apiRequest(`/projects/${encodeURIComponent(projectId)}/ai-maintain`, {
    method: "POST",
    body: JSON.stringify({ instruction }),
  });
}

export interface AutonomousProjectTaskResponse {
  success: boolean;
  summary: string;
  changedFiles: string[];
  excludedFileCount: number;
  test: {
    passed: boolean;
    errors: string[];
  };
  runtimeTests: {
    passed: boolean;
    skipped: boolean;
    errors: string[];
    stdout?: string;
    stderr?: string;
  };
  build: {
    passed: boolean;
    attempts: number;
    stage?: string;
    errors: string[];
    stdout?: string;
    stderr?: string;
  };
}

export async function runAutonomousProjectTask(
  projectId: string,
  instruction: string,
): Promise<AutonomousProjectTaskResponse> {
  return apiRequest(
    `/projects/${encodeURIComponent(projectId)}/ai-autonomous`,
    {
      method: "POST",
      body: JSON.stringify({ instruction }),
    },
  );
}

export async function buildProject(projectId: string): Promise<ProjectActionResponse> {
  return apiRequest(`/projects/${encodeURIComponent(projectId)}/build`, {
    method: "POST",
  });
}

export async function runProject(projectId: string): Promise<ProjectActionResponse> {
  return apiRequest(`/projects/${encodeURIComponent(projectId)}/run`, {
    method: "POST",
  });
}

export async function stopProject(projectId: string): Promise<ProjectActionResponse> {
  return apiRequest(`/projects/${encodeURIComponent(projectId)}/stop`, {
    method: "POST",
  });
}

export async function downloadWorkspaceZip(projectId: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/api/projects/${encodeURIComponent(projectId)}/download`,
      { credentials: "include" },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new Error(`Could not reach HexaWave backend: ${message}`);
  }
  if (!response.ok) {
    throw new Error(`Project ZIP download failed (${response.status}): ${await response.text()}`);
  }
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${projectId}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadProjectZip(data: {
  projectName: string;
  projectType: string;
  stack: string;
  prompt: string;
}) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/ai/generate/zip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new Error(`Could not reach HexaWave backend: ${message}`);
  }
  if (!response.ok) {
    throw new Error(`Project ZIP generation failed (${response.status}): ${await response.text()}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const safeName = data.projectName.trim().replace(/[^a-zA-Z0-9-_]+/g, "-").toLowerCase()
    || "hexawave-project";
  link.download = `${safeName}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function generatePreview(data: {
  projectName: string;
  projectType: string;
  stack: string;
  prompt: string;
}) {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/ai/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown network error";
    throw new Error(`Could not reach HexaWave backend: ${message}`);
  }
  if (!response.ok) {
    throw new Error(`Preview generation failed (${response.status}): ${await response.text()}`);
  }
  return response.text();
}

function getFileLanguage(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase();
  const languages: Record<string, string> = {
    css: "css",
    html: "html",
    js: "javascript",
    json: "json",
    md: "markdown",
    py: "python",
    ts: "typescript",
    tsx: "tsx",
  };
  return extension ? languages[extension] ?? "text" : "text";
}

export interface MarketQuote {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  source: string;
  observedAt: string;
}

export interface TradingStrategy {
  id: string;
  name: string;
  symbol: string;
  baseline: number;
  bandPercent: number;
  orderQuantity: number;
  startingCash: number;
  sellBehaviour: "close-only" | "open-short";
  executionMode: "paper" | "live";
  requireApproval: boolean;
  armed: boolean;
  state: "idle" | "running" | "paused" | "stopped";
  createdAt: string;
}

export interface TradingSignal {
  id: string;
  strategyId: string;
  strategyName: string;
  symbol: string;
  action: "BUY" | "SELL" | "HOLD";
  reason: string;
  price: number;
  baseline: number;
  explanation: string;
  executed: boolean;
  createdAt: string;
}

export interface TradingOrder {
  id: string;
  strategyId: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  status: "filled" | "rejected";
  filledPrice: number | null;
  realizedPnl: number;
  reason: string;
  createdAt: string;
}

export interface TradingPosition {
  strategyId: string;
  symbol: string;
  side: "long" | "short";
  quantity: number;
  averageEntryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
}

export interface TradingOverview {
  provider: {
    active: string;
    displayName: string;
    liveData: boolean;
    lastError: string | null;
    watchedSymbols: string[];
    lastTickAt: string | null;
  };
  liveExecutionEnabled: boolean;
  strategies: number;
  runningStrategies: number;
  armedStrategies: number;
  openPositions: number;
  ordersToday: number;
  totalEquity: number;
  totalRealizedPnl: number;
  totalUnrealizedPnl: number;
}

export interface KingCatalog {
  name: string;
  mission: string;
  languages: string[];
  securityControls: Array<{ id: string; name: string; layer: string; summary: string }>;
  aiLayers: Array<{ id: string; name: string; summary: string }>;
  excluded: string;
}

export interface KingSoftwareRequest {
  id: string;
  companyName: string;
  productName: string;
  languages: string[];
  stack: string;
  purpose: string;
  requestedBy: string;
  status: "pending" | "approved" | "rejected";
  generationStatus: "waiting" | "generating" | "ready" | "failed";
  projectId: string | null;
  generationError: string | null;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
}

export async function getTradingOverview(): Promise<TradingOverview> {
  return apiRequest("/trading/overview");
}

export async function getTradingQuotes(): Promise<MarketQuote[]> {
  return apiRequest("/trading/quotes");
}

export async function getTradingStrategies(): Promise<TradingStrategy[]> {
  return apiRequest("/trading/strategies");
}

export async function createTradingStrategy(data: {
  symbol: string;
  baseline?: number;
  name?: string;
  sellBehaviour?: TradingStrategy["sellBehaviour"];
}): Promise<TradingStrategy> {
  return apiRequest("/trading/strategies", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function startTradingStrategy(id: string): Promise<TradingStrategy> {
  return apiRequest(`/trading/strategies/${encodeURIComponent(id)}/start`, { method: "POST" });
}

export async function pauseTradingStrategy(id: string): Promise<TradingStrategy> {
  return apiRequest(`/trading/strategies/${encodeURIComponent(id)}/pause`, { method: "POST" });
}

export async function stopTradingStrategy(id: string): Promise<TradingStrategy> {
  return apiRequest(`/trading/strategies/${encodeURIComponent(id)}/stop`, { method: "POST" });
}

export async function armTradingStrategy(id: string, armed: boolean): Promise<TradingStrategy> {
  return apiRequest(`/trading/strategies/${encodeURIComponent(id)}/arm`, {
    method: "POST",
    body: JSON.stringify({ armed }),
  });
}

export async function runTradingTick(): Promise<unknown> {
  return apiRequest("/trading/tick", { method: "POST" });
}

export async function getTradingSignals(limit = 40): Promise<TradingSignal[]> {
  return apiRequest(`/trading/signals?limit=${limit}`);
}

export async function getTradingOrders(limit = 40): Promise<TradingOrder[]> {
  return apiRequest(`/trading/orders?limit=${limit}`);
}

export async function getTradingPositions(): Promise<TradingPosition[]> {
  return apiRequest("/trading/positions");
}

export async function getKingCatalog(): Promise<KingCatalog> {
  return apiRequest("/king/catalog");
}

export async function getKingRequests(): Promise<KingSoftwareRequest[]> {
  return apiRequest("/king/requests");
}

export async function createKingRequest(data: {
  companyName: string;
  productName: string;
  languages: string[];
  stack?: string;
  purpose: string;
}): Promise<KingSoftwareRequest> {
  return apiRequest("/king/requests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function decideKingRequest(
  id: string,
  decision: "approve" | "reject",
  note?: string,
): Promise<KingSoftwareRequest> {
  return apiRequest(`/king/requests/${encodeURIComponent(id)}/${decision}`, {
    method: "PATCH",
    body: JSON.stringify({ note }),
  });
}

export async function retryKingGeneration(id: string): Promise<KingSoftwareRequest> {
  return apiRequest(`/king/requests/${encodeURIComponent(id)}/generate`, {
    method: "POST",
  });
}

export async function getBillingCatalog(): Promise<BillingCatalog> {
  return apiRequest("/billing/catalog");
}

export async function getBillingAdminConfiguration(): Promise<BillingAdminConfiguration> {
  return apiRequest("/billing/admin/config");
}

export async function updateBillingAdminConfiguration(
  configuration: Omit<BillingAdminConfiguration, "provider">,
): Promise<BillingAdminConfiguration> {
  return apiRequest("/billing/admin/config", {
    method: "PUT",
    body: JSON.stringify(configuration),
  });
}

export async function getBillingAccount() {
  return apiRequest<{
    credits: number;
    creditsPerAiAction: number;
    subscriptions: Array<{
      planId?: "pro" | "team" | "enterprise";
      interval: "monthly" | "yearly" | null;
      status: "creating" | "pending" | "paid" | "failed";
      createdAt: string;
      paidAt?: string;
    }>;
    ledger: Array<{
      id: string;
      reason: "purchase" | "ai-action";
      referenceId: string;
      status: "credited" | "charged" | "released";
      delta: number;
      createdAt: string;
    }>;
    payments: Array<{
      id: string;
      kind: "subscription" | "software-request" | "credits";
      amountPaise: number;
      currency: "INR";
      status: "creating" | "pending" | "paid" | "failed";
      createdAt: string;
      paidAt?: string;
    }>;
  }>("/billing/account");
}

export async function createSubscriptionCheckout(
  planId: "pro" | "team" | "enterprise",
  idempotencyKey: string,
): Promise<BillingCheckout> {
  return apiRequest("/billing/checkout/subscription", {
    method: "POST",
    body: JSON.stringify({ planId, idempotencyKey }),
  });
}

export async function createCreditsCheckout(
  packId: string,
  idempotencyKey: string,
): Promise<BillingCheckout> {
  return apiRequest("/billing/checkout/credits", {
    method: "POST",
    body: JSON.stringify({ packId, idempotencyKey }),
  });
}

export async function createSoftwareRequestCheckout(
  request: {
    companyName: string;
    productName: string;
    purpose: string;
    languages: string[];
  },
  idempotencyKey: string,
): Promise<BillingCheckout> {
  return apiRequest("/billing/checkout/software-request", {
    method: "POST",
    body: JSON.stringify({ request, idempotencyKey }),
  });
}

export async function verifyBillingCheckout(
  paymentIntentId: string,
  payment: RazorpayPaymentResponse,
) {
  return apiRequest<{
    success: boolean;
    paymentIntentId: string;
    kind: "subscription" | "software-request" | "credits";
    status: string;
    request?: KingSoftwareRequest | null;
  }>("/billing/checkout/verify", {
    method: "POST",
    body: JSON.stringify({ paymentIntentId, ...payment }),
  });
}
