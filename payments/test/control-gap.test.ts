import assert from "node:assert/strict";
import { test } from "node:test";
import { recordTransfer } from "../src/audit.ts";
import { submitTransfer } from "../src/transfer.ts";

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
