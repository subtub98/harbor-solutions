export type TransferRequest = {
  fromAccount: string;
  toAccount: string;
  amountCents: number;
  actor: string;
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
  /** Required by PCI-DSS 10.2. */
  amountCents: number;
};
