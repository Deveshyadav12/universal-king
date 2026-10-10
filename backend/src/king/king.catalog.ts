/**
 * Universal King catalog: languages, defensive security controls, and AI layers.
 *
 * This catalog is intentionally defensive. Offensive intrusion tooling is not
 * shipped as part of the platform.
 */

export const KING_LANGUAGES = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "C#",
  "Kotlin",
  "Swift",
  "SQL",
  "HTML",
  "CSS",
] as const;

export const KING_SECURITY_CONTROLS = [
  {
    id: "zero-trust",
    name: "Zero Trust access",
    layer: "network",
    summary: "Every request is authenticated, authorised, and audited. No implicit trust inside the network.",
  },
  {
    id: "rbac",
    name: "Least-privilege RBAC",
    layer: "identity",
    summary: "Operators and companies only receive the roles they need. Admin actions stay gated.",
  },
  {
    id: "approval-gate",
    name: "Human approval gate",
    layer: "governance",
    summary: "AI code generation starts only after operator approval; deployment requires a separate decision.",
  },
  {
    id: "tls",
    name: "Encrypted transport",
    layer: "network",
    summary: "Sessions use HTTPS in production, httpOnly cookies, and CORS limited to the app origin.",
  },
  {
    id: "audit",
    name: "Approval history",
    layer: "governance",
    summary: "Company requests, decisions, and code-generation outcomes are stored for later review.",
  },
  {
    id: "workspace-isolation",
    name: "Private workspace access",
    layer: "identity",
    summary: "Builders see their own company requests and generated projects; administrators review the approval queue.",
  },
  {
    id: "secrets",
    name: "Secrets isolation",
    layer: "platform",
    summary: "Credentials stay in environment variables. They are never committed or returned by APIs.",
  },
  {
    id: "sast",
    name: "Secure software review",
    layer: "application",
    summary: "Generated workspaces are reviewed for injection, auth gaps, and unsafe defaults before release.",
  },
  {
    id: "owasp-asvs",
    name: "OWASP ASVS baseline",
    layer: "application",
    summary: "Application controls follow OWASP ASVS categories: auth, session, access, and data protection.",
  },
  {
    id: "authorized-security-testing",
    name: "Authorized security validation",
    layer: "application",
    summary: "Security checks stay scoped to owned or explicitly authorized systems; exploit kits and unauthorized access are excluded.",
  },
] as const;

export const KING_AI_LAYERS = [
  {
    id: "architect",
    name: "Architect",
    summary: "Turns a company brief into a stack, file plan, and risk notes.",
  },
  {
    id: "builder",
    name: "Builder",
    summary: "Generates multi-language workspaces and keeps edits inside the approved project.",
  },
  {
    id: "reviewer",
    name: "Reviewer",
    summary: "Checks generated software against the defensive controls before an operator can approve it.",
  },
] as const;
