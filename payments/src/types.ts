export type TransferRequest = {
  fromAccount: string;
  toAccount: string;
  amountCents: number;
  actor: string;
  /** CONTROL GAP (practice 3): accepted on the request, ignored by submitTransfer. */
  idempotencyKey?: string;
};

export type TransferResult = {
  id: string;
  status: "accepted" | "rejected";
  reason?: string;
};

export type AuditRecord = {
  id: string;
  timestamp: string;
  actor: string;
  fromAccount: string;
  toAccount: string;
  /** Required by PCI-DSS 10.2. Closed in SUB-8 / PR #1. */
  amountCents: number;
  status?: "accepted" | "rejected";
  reason?: string;
};

export type AuditAccessRecord = {
  timestamp: string;
  actor: string;
};
