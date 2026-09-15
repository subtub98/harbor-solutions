import type { AuditRecord } from "./types.ts";

/**
 * PCI-DSS 10.2 requires audit records for access to sensitive financial data.
 * CONTROL GAP (seeded on main): amountCents is dropped. Harbor InfoSec tracks
 * this as control:pci-10.2. Remediate on a branch + PR — never push to main.
 */
export function recordTransfer(input: {
  id: string;
  timestamp: string;
  actor: string;
  fromAccount: string;
  toAccount: string;
  amountCents: number;
}): AuditRecord {
  return {
    id: input.id,
    timestamp: input.timestamp,
    actor: input.actor,
    fromAccount: input.fromAccount,
    toAccount: input.toAccount,
    // amountCents intentionally omitted — this is the control gap
  };
}
