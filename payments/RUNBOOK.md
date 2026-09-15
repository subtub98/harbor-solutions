# Harbor ACH runbook

## Originate a credit

`POST /transfers` with `fromAccount`, `toAccount`, `amountCents`, `actor`.

## Audit

`GET /audit` returns the in-memory transfer log. **PCI-DSS 10.2** requires each record to include actor, accounts, timestamp, and **amount**.

## Known control gap (main)

`payments/src/audit.ts` currently drops `amountCents`. Do not hotfix on `main`. Open a branch and a PR. Linear project: **harbor**. Label: `control:pci-10.2`.
