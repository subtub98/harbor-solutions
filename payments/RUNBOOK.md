# Harbor ACH runbook

## Originate a credit

`POST /transfers` with `fromAccount`, `toAccount`, `amountCents`, `actor`.

## Audit

`GET /audit` returns the in-memory transfer log. **PCI-DSS 10.2** requires each record to include actor, accounts, timestamp, and **amount**.

## PCI-DSS 10.2 control (SUB-8)

`payments/src/audit.ts` includes `amountCents` on every audit record. Remediation branch: `cursor/fix-sub-8-pci-10-2-b0cd`. Linear: **SUB-8**. Label: `control:pci-10.2`.
