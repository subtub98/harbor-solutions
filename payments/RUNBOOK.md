# Harbor ACH runbook

## Originate a credit

`POST /transfers` with `fromAccount`, `toAccount`, `amountCents`, `actor`, optional `idempotencyKey`.

## Audit

`GET /audit?actor=` returns the in-memory transfer log. **PCI-DSS 10.2** requires each transfer record to include actor, accounts, timestamp, and **amount** (closed in SUB-8). It also requires logging **rejected attempts** and **who read the audit trail**.

## Closed

- **SUB-8 / PCI-DSS 10.2 amount:** `payments/src/audit.ts` includes `amountCents`. PR #1.
- **SUB-9 / maximum ACH amount:** `payments/src/limits.ts` rejects `amountCents` above 100_000_000 ($1,000,000).

## Open control gaps (seeded on purpose)

Do not hotfix on `main`. One Linear ticket, one branch, one PR per gap.

1. **Rejected transfers skip the audit log** — `payments/src/transfer.ts` (practice 2).
2. **Idempotency key is ignored** — `submitTransfer` (practice 3). Same key must return the same id.
3. **Audit reads are not logged** — `listAuditLog` (interview demo). PCI-DSS 10.2 access to audit trails.
