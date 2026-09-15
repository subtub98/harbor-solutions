import assert from "node:assert/strict";
import { test } from "node:test";
import { recordTransfer } from "../src/audit.ts";
import { listAuditLog, listAuditReads, submitTransfer } from "../src/transfer.ts";

test("accepted transfer returns an id", () => {
  const result = submitTransfer({
    fromAccount: "021000021:111122223333",
    toAccount: "121000248:999988887777",
    amountCents: 250_000,
    actor: "ops.wire",
  });
  assert.equal(result.status, "accepted");
  assert.ok(result.id);
});

test("rejects missing amount", () => {
  const result = submitTransfer({
    fromAccount: "021000021:111122223333",
    toAccount: "121000248:999988887777",
    amountCents: 0,
    actor: "ops.wire",
  });
  assert.equal(result.status, "rejected");
});

test("PCI-DSS 10.2: audit record includes amountCents", () => {
  const record = recordTransfer({
    id: "tx_test",
    timestamp: "2026-09-14T00:00:00.000Z",
    actor: "ops.wire",
    fromAccount: "021000021:111122223333",
    toAccount: "121000248:999988887777",
    amountCents: 250_000,
  });
  assert.equal(
    record.amountCents,
    250_000,
    "control gap: ACH audit log omits amount (PCI-DSS 10.2)",
  );
});

test("practice 1: ACH amount has a maximum of 100_000_000 cents", () => {
  const result = submitTransfer({
    fromAccount: "021000021:111122223333",
    toAccount: "121000248:999988887777",
    amountCents: 5_000_000_000,
    actor: "ops.wire",
  });
  assert.equal(
    result.status,
    "rejected",
    "control gap: no maximum ACH amount in limits.ts",
  );
});

test("practice 2: rejected transfers are written to the audit log", () => {
  submitTransfer({
    fromAccount: "021000021:111122223333",
    toAccount: "021000021:111122223333",
    amountCents: 250_000,
    actor: "ops.wire",
  });
  const rejected = listAuditLog().filter((row) => row.status === "rejected");
  assert.ok(
    rejected.length > 0,
    "control gap: rejected transfers skip the audit log",
  );
});

test("practice 3: same idempotencyKey returns the same transfer id", () => {
  const first = submitTransfer({
    fromAccount: "021000021:111122223333",
    toAccount: "121000248:999988887777",
    amountCents: 250_000,
    actor: "ops.wire",
    idempotencyKey: "wire-practice-3",
  });
  const second = submitTransfer({
    fromAccount: "021000021:111122223333",
    toAccount: "121000248:999988887777",
    amountCents: 250_000,
    actor: "ops.wire",
    idempotencyKey: "wire-practice-3",
  });
  assert.equal(first.status, "accepted");
  assert.equal(
    second.id,
    first.id,
    "control gap: idempotencyKey is ignored and a second transfer is created",
  );
});

test("demo: reading the audit log records the reader", () => {
  listAuditLog("grc.officer");
  assert.ok(
    listAuditReads().some((row) => row.actor === "grc.officer"),
    "control gap: GET /audit does not log who read the audit trail (PCI-DSS 10.2)",
  );
});
