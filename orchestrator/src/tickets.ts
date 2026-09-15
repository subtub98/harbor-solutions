export type GapId = "max-amount" | "rejected-audit" | "idempotency" | "audit-read";

export type GapTicket = {
  id: GapId;
  command: string;
  title: string;
  labels: string[];
  description: string;
};

export const GAPS: Record<GapId, GapTicket> = {
  "max-amount": {
    id: "max-amount",
    command: "npm run demo:practice-1",
    title: "No maximum ACH amount — reject over 100_000_000 cents",
    labels: ["sdlc:control-gap", "Bug", "risk:high"],
    description: [
      "[repo=subtub98/harbor-solutions]",
      "",
      "## Control",
      "Operational / fraud limit. Harbor ACH must reject amountCents above 100000000 ($1,000,000).",
      "",
      "## Evidence",
      "payments/src/limits.ts has MIN_CENTS only.",
      'payments/test/control-gap.test.ts → "practice 1: ACH amount has a maximum of 100_000_000 cents"',
      "",
      "## Policy",
      "- One gap only. Do not fix rejected-audit, idempotency, or audit-read gaps in this PR.",
      "- New branch, PR into main, do not merge, do not mark Linear Done.",
    ].join("\n"),
  },
  "rejected-audit": {
    id: "rejected-audit",
    command: "npm run demo:practice-2",
    title: "PCI-DSS 10.2: rejected ACH transfers are not audited",
    labels: ["sdlc:control-gap", "control:pci-10.2", "Bug", "risk:high"],
    description: [
      "[repo=subtub98/harbor-solutions]",
      "",
      "## Control",
      "PCI-DSS 10.2 completeness. Rejected transfers (same_account, missing_fields, invalid_amount) must be written to the audit log with status rejected and a reason.",
      "",
      "## Evidence",
      "payments/src/transfer.ts reject() returns without recordTransfer.",
      'payments/test/control-gap.test.ts → "practice 2: rejected transfers are written to the audit log"',
      "",
      "## Policy",
      "- Fix only this gap.",
      "- New branch, PR into main, do not merge, do not mark Linear Done.",
    ].join("\n"),
  },
  idempotency: {
    id: "idempotency",
    command: "npm run demo:practice-3",
    title: "Duplicate ACH originations — honor idempotencyKey",
    labels: ["sdlc:control-gap", "Bug", "risk:high"],
    description: [
      "[repo=subtub98/harbor-solutions]",
      "",
      "## Control",
      "Payments idempotency. If idempotencyKey is present, a second submitTransfer with the same key must return the first transfer id and must not create a second accepted transfer.",
      "",
      "## Evidence",
      "payments/src/transfer.ts comments that idempotencyKey is ignored.",
      'payments/test/control-gap.test.ts → "practice 3: same idempotencyKey returns the same transfer id"',
      "",
      "## Policy",
      "- Fix only this gap.",
      "- New branch, PR into main, do not merge, do not mark Linear Done.",
    ].join("\n"),
  },
  "audit-read": {
    id: "audit-read",
    command: "npm run demo:interview",
    title: "PCI-DSS 10.2: GET /audit does not log who read the audit trail",
    labels: ["sdlc:control-gap", "control:pci-10.2", "Bug", "risk:high"],
    description: [
      "[repo=subtub98/harbor-solutions]",
      "",
      "## Control",
      "PCI-DSS 10.2 — log access to audit trails. listAuditLog / GET /audit?actor= must record { actor, timestamp } so listAuditReads() includes that officer.",
      "",
      "## Evidence",
      "payments/src/transfer.ts listAuditLog discards actor.",
      'payments/test/control-gap.test.ts → "demo: reading the audit log records the reader"',
      "",
      "## Policy",
      "- Fix only this gap.",
      "- New branch, PR into main, do not merge, do not mark Linear Done.",
      "- Bugbot reviews bugs. CAB reviews this control. Human merges.",
    ].join("\n"),
  },
};

export function parseGapId(raw: string | undefined): GapId {
  if (!raw || !(raw in GAPS)) {
    throw new Error(
      `Unknown gap "${raw ?? ""}". Use max-amount | rejected-audit | idempotency | audit-read`,
    );
  }
  return raw as GapId;
}
