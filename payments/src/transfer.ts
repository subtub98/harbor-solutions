import { randomUUID } from "node:crypto";
import { recordTransfer } from "./audit.ts";
import { assertTransferAmount } from "./limits.ts";
import type { AuditAccessRecord, AuditRecord, TransferRequest, TransferResult } from "./types.ts";

const ledger: AuditRecord[] = [];
const auditReads: AuditAccessRecord[] = [];
const idempotencyCache = new Map<string, TransferResult>();

function reject(reason: string, req: TransferRequest): TransferResult {
  const id = randomUUID();
  const record = {
    ...recordTransfer({
      id,
      timestamp: new Date().toISOString(),
      actor: req.actor,
      fromAccount: req.fromAccount,
      toAccount: req.toAccount,
      amountCents: req.amountCents,
    }),
    status: "rejected" as const,
    reason,
  };
  ledger.push(record);
  return { id, status: "rejected", reason };
}

export function submitTransfer(req: TransferRequest): TransferResult {
  if (!req.fromAccount || !req.toAccount || !req.actor) {
    return reject("missing_fields", req);
  }
  if (req.fromAccount === req.toAccount) {
    return reject("same_account", req);
  }

  try {
    assertTransferAmount(req.amountCents);
  } catch {
    return reject("invalid_amount", req);
  }

  // CONTROL GAP (practice 3): idempotencyKey is ignored. Two identical keys
  // create two transfers.
  void idempotencyCache;

  const id = randomUUID();
  const record = recordTransfer({
    id,
    timestamp: new Date().toISOString(),
    actor: req.actor,
    fromAccount: req.fromAccount,
    toAccount: req.toAccount,
    amountCents: req.amountCents,
  });
  ledger.push(record);
  return { id, status: "accepted" };
}

export function listAuditLog(actor?: string): AuditRecord[] {
  // CONTROL GAP (demo): PCI-DSS 10.2 also requires logging who READ the audit
  // trail. actor is accepted and discarded.
  void actor;
  return [...ledger];
}

export function listAuditReads(): AuditAccessRecord[] {
  return [...auditReads];
}
