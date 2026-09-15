import { randomUUID } from "node:crypto";
import { recordTransfer } from "./audit.ts";
import { assertTransferAmount } from "./limits.ts";
import type { AuditRecord, TransferRequest, TransferResult } from "./types.ts";

const ledger: AuditRecord[] = [];

export function submitTransfer(req: TransferRequest): TransferResult {
  if (!req.fromAccount || !req.toAccount || !req.actor) {
    return { id: "", status: "rejected", reason: "missing_fields" };
  }
  if (req.fromAccount === req.toAccount) {
    return { id: "", status: "rejected", reason: "same_account" };
  }

  try {
    assertTransferAmount(req.amountCents);
  } catch {
    return { id: "", status: "rejected", reason: "invalid_amount" };
  }

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

export function listAuditLog(): AuditRecord[] {
  return [...ledger];
}
