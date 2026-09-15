import type { AuditRecord } from "./types.ts";

/**
 * PCI-DSS 10.2 requires audit records for access to sensitive financial data,
 * including amount. Harbor InfoSec tracks this as control:pci-10.2.
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
    amountCents: input.amountCents,
  };
}
