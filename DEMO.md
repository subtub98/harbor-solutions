# Harbor Solutions — what we built and how to demo it

This is the Field Engineering Cursor SDK prototype. Plain English, with the real names, links, and settings we used.

The interview prompt was: build something with the **Cursor SDK** that solves a real SDLC problem in an enterprise. We picked financial services, and we went deep on **one loop**: a control gap is found, it becomes a Linear ticket, an agent fixes it on a branch, a PR is opened, review happens, a human merges. Nothing ever pushes straight to `main`.

---

## What Harbor is

Harbor is a fake bank payments team. The “product” is a tiny ACH transfer API in this repo (`payments/`). It can accept a transfer (`POST /transfers`), store an in-memory audit log, and expose that log (`GET /audit`).

That API is intentionally small. The thing being graded is not a core banking platform. It is the **software development lifecycle around a regulated payment change**.

Repo: https://github.com/subtub98/harbor-solutions  
Linear project: https://linear.app/subbu-iyer/project/harbor-3e674a0b312a  
Linear workspace: Subbu Iyer, team key `SUB`

The first seeded problem was **PCI-DSS 10.2 amount**: `payments/src/audit.ts` dropped `amountCents`. That gap is **closed** (SUB-8, [PR #1](https://github.com/subtub98/harbor-solutions/pull/1)).

There are **four new seeded bugs**, same shape as that one: a failing test, a Linear ticket, full pipeline (Clearing → ingest → remediator branch/PR → Bugbot → CAB → you approve, do not let the agent merge). Three are practice. One is the interview. Each ticket must fix **only that gap**. Leave the others failing.

How to run every example (this never changes):

1. File the Linear ticket in project **harbor** (paste the body from this doc). Labels: `sdlc:control-gap`, `Bug`, `risk:high`.
2. Tell **Clearing**: triage this ticket, comment on Linear, do not change code, do not set Done. If it asks In Review vs Done, pick **In Review**.
3. You approve the fix out loud.
4. `npm run ingest -- --issue SUB-XX`
5. Watch the remediator open a **new branch** and a PR as cursor[bot]. CAB posts PASS/BLOCK. Linear goes **In Review**.
6. Optionally Approve in GitHub to practice protection. **Do not merge practice PRs.** Do not merge the demo PR in the room unless they ask.

`npm test` currently fails on the four open gaps. That is the point. After a practice PR is merged, that one test goes green. Do not merge the **demo** gap until after the interview.

---

## The pieces in the repo

| Path | What it is |
| --- | --- |
| `payments/` | The ACH service: `audit.ts`, `transfer.ts`, `limits.ts`, `index.ts`, OpenAPI, `RUNBOOK.md`, tests |
| `orchestrator/` | TypeScript Cursor SDK program that talks to Linear and launches cloud agents |
| `.cursor/BUGBOT.md` | Rules Bugbot reads on every PR |
| `.cursor/hooks.json` + `.cursor/hooks/block-push-main.mjs` | Blocks `git push` / `checkout` / `merge` of `main` for agents |
| `.cursor/rules/harbor-change-control.mdc` | Always-on Cursor rule: never ship to `main`, never mark Linear Done |
| `grok-bot/CLEARING.md` | Standing job for the Grok Bot named Clearing |
| `.env` | Your Cursor and Linear API keys (gitignored, never committed) |
| `.env.example` | Same file with empty keys, safe to commit |

Commands:

```bash
npm test                          # payments tests
npm run demo                      # create a NEW Linear ticket and run the full pipeline
npm run ingest -- --issue SUB-XX   # full pipeline on an EXISTING Linear ticket
```

The extra `--` in `ingest` is required. Without it, npm eats `--issue` and you get a usage error.

---

## Who does what (do not mix these up)

This is the sentence you should be able to say in the interview:

**Linear is the system of record for work. Clearing (Grok Bot) is intake and triage. The Cursor SDK remediator writes code. Bugbot hunts bugs on the PR. The SDK CAB reviewer checks controls and evidence. You are the only one who merges to `main`.**

### Linear

Linear is where work starts and where the audit trail lives.

- Workspace: **Subbu Iyer**
- Project: **harbor**
- Team key: **SUB** (issues look like `SUB-8`)
- Workflow we use: **Todo / Backlog → In Progress → In Review**. Agents are **not** allowed to set **Done**. Done is a human GRC step after you accept evidence.

Labels we created and used:

- `sdlc:control-gap`
- `control:pci-10.2`
- plus existing `Bug` and `risk:high`

What Linear actually did in the live run:

1. `npm run demo` (and later ingest) created or loaded **SUB-8**: “PCI-DSS 10.2: ACH transfers omit amount from the audit log.”
2. The orchestrator moved it to **In Progress** when the remediator started.
3. The remediator and orchestrator commented the branch and PR URL on the ticket.
4. After the CAB reviewer finished, the orchestrator moved it to **In Review** and posted a change-control packet (control ID, PR, both agent IDs, “human merges”).
5. Clearing (Grok Bot) later wrote a triage / CAB-style memo on SUB-8. When it found the ticket Done, it asked you whether to move it back. You chose **In Review**, which matches policy.

Linear is also passed into the **cloud agents** as an MCP server (`https://mcp.linear.app/sse` with `LINEAR_API_KEY`), so those agents can comment on the issue themselves. The orchestrator also comments via Linear’s GraphQL API directly, so the ticket still updates even if the agent forgets.

Ticket: https://linear.app/subbu-iyer/issue/SUB-8/pci-dss-102-ach-transfers-omit-amount-from-the-audit-log

### Grok Bot (Clearing)

Clearing is **not** the coding agent. It lives in the Grok Bot app. It has Linear and GitHub plugins. GitHub used a **personal access token** (classic, `repo` scope) in the plugin setup field. Linear used browser OAuth.

Job: read the Linear ticket and the GitHub repo/PR, map it to a control, comment on Linear, ask you before anyone remediates. It must not push, merge, mark Done, or run `npm run ingest` unless you tell it to.

You created Clearing, pasted the profile from `grok-bot/CLEARING.md`, and ran a first task against SUB-8 and PR #1. That was a **retrospective triage** (the code fix was already done). That is still a valid SDLC demo of Plan / Triage.

### Cursor SDK cloud agents (two of them)

Both are created from `orchestrator/src/agents.ts` with `@cursor/sdk`, model `composer-2.5`, runtime **cloud** (they run on a Cursor VM that clones GitHub, not on your laptop). In Cursor Web they are hidden unless you set **Filter → Source → SDK**.

**1. Remediator** (`harbor-remediator-SUB-8`)

- `Agent.create` + `agent.send` + stream + `wait()`
- Clones `https://github.com/subtub98/harbor-solutions` from `main`
- `workOnCurrentBranch: false` — always a **new branch**, never commit on `main`
- `autoCreatePR: true` — opens a PR when the run finishes
- `openAsCursorGithubApp: true` — PR author is **cursor[bot]**, not your personal GitHub user
- `skipReviewerRequest: true` — does not page you as a GitHub reviewer
- Metadata tags: `linear_issue`, `role=remediator`
- Prompt: fix **only** the Linear issue’s gap, update the runbook for that control, cite the ticket, never merge, never mark Done. Other seeded tests may still fail.
- If the reported git branch is `main`, the orchestrator **aborts**
- First successful run: agent `bc-d02c4474-94a8-4228-b495-57635794b0cd`, run `run-269f4b1b-0b61-46ac-9448-4a454f3cb2c9`, branch `cursor/fix-sub-8-pci-10-2-b0cd`

**2. CAB reviewer** (`harbor-reviewer-SUB-8`)

- Second `Agent.create`, attached to the PR with `repos: [{ url, prUrl }]`
- `workOnCurrentBranch: true` — stay on the **PR branch**, which is already not `main`
- `autoCreatePR: false` — must not open another PR
- Prompt: comment-only Harbor CAB review (PASS/BLOCK), do not duplicate Bugbot’s bug hunt, do not merge, do not set Linear Done
- First successful run: agent `bc-0abeab14-b3ae-4773-875a-25990033cc15`, run `run-f0b41625-26e5-4065-bc0c-fab33d40536a`

Startup failures (`CursorAgentError`, never started) are treated differently from a run that starts and then fails (`result.status === "error"`). That distinction is in the orchestrator on purpose.

### Bugbot

Bugbot is Cursor’s **GitHub PR automation**, not an SDK agent. It is enabled on `subtub98/harbor-solutions`. It reads `.cursor/BUGBOT.md`: require `amountCents` on audit records, don’t leak extra PII, don’t push `main`, keep the control-gap test green.

It is supposed to comment on the PR by itself. You also commented `bugbot run` on PR #1. If a Bugbot review did not show before merge, say that as a limitation: you triggered it; merge happened quickly; CAB still covered control review.

Bugbot ≠ Clearing ≠ the SDK remediator ≠ the SDK CAB reviewer.

### GitHub and the PR

Repo: https://github.com/subtub98/harbor-solutions

What happened on PR #1 (https://github.com/subtub98/harbor-solutions/pull/1):

- Author: **cursor[bot]**
- Branch: `cursor/fix-sub-8-pci-10-2-b0cd` → `main`
- It was opened as a **draft**, you marked it ready for review
- Files: `payments/src/audit.ts` (keep `amountCents`), `payments/src/types.ts` (amount required), `payments/RUNBOOK.md`
- CAB reviewer posted **Harbor CAB review — PASS** as a PR comment
- Checks passed
- Branch protection then blocked merge until **you** submitted an **Approve** review (the CAB comment is not a GitHub approval)
- You approved and merged. That was the human release step.

Branch protection on `main` (classic rule):

- Require a pull request before merging
- Require 1 approval
- Do not allow bypassing
- Lock branch **off** (or nobody could merge PRs)

We also pushed the initial tree so `main` existed. Cloud agents cannot clone a repo with no `main`. That first push was **you**, not an agent.

### Automations (the mechanical ones)

1. **Orchestrator** — your Node script. Linear GraphQL + two SDK cloud agents in sequence.
2. **Linear MCP** on those cloud agents — they can comment on tickets.
3. **`autoCreatePR`** — remediator opens the GitHub PR.
4. **Bugbot** — PR review automation + `.cursor/BUGBOT.md`.
5. **Hooks** — cloud agents load `.cursor/hooks.json`. Any `git` command that tries to push, check out, or merge `main` is denied.
6. **Cursor rule** `harbor-change-control.mdc` — same policy in the prompt layer.
7. **GitHub branch protection** — `main` cannot take a direct push; merge needs a PR + your approval.
8. **Grok Bot plugins** — Clearing can read/write Linear and read GitHub without you clicking around.

There is **no** Linear webhook. The demo trigger is a terminal command so a missed webhook cannot kill a 20-minute live session.

---

## The full workflow, start to finish

This is the happy path we already ran once.

1. **Gap exists on `main`.** `audit.ts` omits amount. `npm test` fails on the PCI test. Runbook says so.
2. **Plan.** A Linear issue is created in project harbor (either `npm run demo` or you file it). Labels: `sdlc:control-gap`, `control:pci-10.2`. Body includes `[repo=subtub98/harbor-solutions]` and “do not push main.”
3. **Triage.** Clearing reads Linear + GitHub, comments severity and control mapping, asks you to approve a fix. Ticket is not Done.
4. **Build.** You run `npm run ingest -- --issue SUB-8` (or demo just created it). Orchestrator sets **In Progress**. Remediator cloud agent clones `main`, creates a **new** branch, fixes code, runs tests, opens a PR as cursor[bot].
5. **Verify.** Bugbot reviews the PR for bugs/security. CAB cloud agent reviews controls, tests, Linear citation, runbook, branch policy. Posts PASS/BLOCK. Orchestrator sets Linear **In Review** and writes the evidence packet.
6. **Release.** You Approve in GitHub. You click Merge. Agents cannot. Protection enforces it.
7. **Operate.** Runbook on the branch (and then on `main` after merge) matches the code. Clearing can write a retrospective on the ticket. Ticket stays **In Review** until you personally accept it as Done.

If anything tries to use `main` as the working branch, either the hook denies the git command, the orchestrator aborts, or GitHub rejects the push.

---

## How this maps to SDLC in a demo

Say this out loud while you click. Do not demo a list of Cursor features. Demo the loop.

| SDLC stage | What they see | Who |
| --- | --- | --- |
| Plan | Linear ticket with a control ID, owner, labels, project harbor | You + Clearing |
| Triage / design | Clearing’s comment: blast radius, PCI-DSS 10.2, approve-to-fix | Grok Bot |
| Build | Cloud remediator streaming in the terminal; new branch; PR from cursor[bot] | Cursor SDK |
| Verify | PR checks, Bugbot (bugs), CAB comment (controls), 1 GitHub approval required | Bugbot + SDK reviewer + you |
| Release | You merge. `main` is protected. Linear still In Review | You |
| Operate | Runbook + Linear evidence packet. Optional child attestation ticket | SDK, then Clearing |

The opinionated constraint to defend: **closing Linear to Done is not an agent job.** Banks will not let a bot attest a control. Leaving it In Review is the point, not a missing feature.

The other constraint: **native Linear “assign to Cursor” is fewer moving parts, but it is not an SDK prototype.** We drive `Agent.create` from our orchestrator so policy, retries, and audit live in our code.

Watch SDK agents: Cursor Web → Filter → Source → SDK.

---

## What we actually did, in order

1. Chose “control gap → PR” on a 4-file ACH app (not a full bank UI).
2. Connected Linear (project harbor), GitHub repo, Bugbot, Cursor API key, Linear API key.
3. Built payments + orchestrator + Bugbot rules + no-main hook.
4. First `npm run demo` failed: GitHub had **no `main`** yet. Expected PCI test failure was not the problem.
5. Committed the seed on branch `cursor/seed-harbor-ach-control-gap`, then published that commit to `main` so cloud agents could clone.
6. `npm run ingest -- --issue SUB-8` succeeded. Remediator + CAB reviewer. PR #1.
7. You turned on classic branch protection (PR + 1 approval, no bypass).
8. Merge was blocked until you **Approved** on the PR. Then you merged.
9. You created Grok Bot **Clearing**, connected GitHub (PAT) and Linear, triaged SUB-8, and moved the ticket back to In Review when asked.
10. Committed `grok-bot/CLEARING.md` and the ingest `--` fix on the feature branch and pushed it.

Known leftover: after you push the four new seeded bugs, `npm test` fails on those four tests until each pipeline closes one. The original PCI amount test should stay green.

---

## Four full pipelines (three practice, one interview)

Each one is the **same loop as SUB-8**: seeded bug, failing test, Linear ticket, Clearing triage, `npm run ingest`, remediator on a new branch, PR from cursor[bot], Bugbot, CAB reviewer, Linear **In Review**, you are the only merger. Do not use `npm run demo` for these — that helper still files the old amount ticket, which is already fixed.

Push these seeded bugs to `main` **once** (human PR) before you practice, or cloud agents will still clone the old `main` without them.

Do not merge practice PRs. Do not merge the interview PR in the room.

---

### Practice 1 — No maximum ACH amount

**The bug.** `payments/src/limits.ts` rejects amounts below 1 cent and nothing else. A $50,000,000 wire is accepted. Test: `practice 1: ACH amount has a maximum of 100_000_000 cents` in `payments/test/control-gap.test.ts` (fails until the remediator adds a ceiling of **100_000_000 cents**).

**Linear title:** `No maximum ACH amount — reject over 100_000_000 cents`

**Linear body (paste):**

```
[repo=subtub98/harbor-solutions]

## Control
Operational / fraud limit. Harbor ACH must reject amountCents above 100000000 ($1,000,000).

## Evidence
payments/src/limits.ts has MIN_CENTS only.
payments/test/control-gap.test.ts → "practice 1: ACH amount has a maximum of 100_000_000 cents"

## Policy
- One gap only. Do not fix rejected-audit, idempotency, or audit-read gaps in this PR.
- New branch, PR into main, do not merge, do not mark Linear Done.
```

**Clearing:** Triage blast radius (unlimited wires), ask Subbu to approve ingest. Comment on Linear. No code.

**Ingest:** `npm run ingest -- --issue SUB-XX`

**What you should see:** Remediator edits `limits.ts` (+ a reject path), practice 1 test goes green, other practice/demo tests may still fail. PR cites the ticket. CAB PASS if only this gap closed. Linear In Review. Branch is not `main`.

**SDLC in this run:** Plan = this ticket. Triage = Clearing. Build = remediator. Verify = Bugbot + CAB. Release = you would merge later. Operate = runbook line about the $1M cap.

---

### Practice 2 — Rejected transfers skip the audit log

**The bug.** `submitTransfer` only calls `recordTransfer` on success. Same-account, missing fields, and invalid amount return `rejected` and leave **no** audit row. PCI-DSS 10.2 is about recording access attempts, not only successes. Test: `practice 2: rejected transfers are written to the audit log`.

**Linear title:** `PCI-DSS 10.2: rejected ACH transfers are not audited`

**Linear body (paste):**

```
[repo=subtub98/harbor-solutions]

## Control
PCI-DSS 10.2 completeness. Rejected transfers (same_account, missing_fields, invalid_amount) must be written to the audit log with status rejected and a reason.

## Evidence
payments/src/transfer.ts reject() returns without recordTransfer.
payments/test/control-gap.test.ts → "practice 2: rejected transfers are written to the audit log"

## Policy
- Fix only this gap.
- New branch, PR into main, do not merge, do not mark Linear Done.
```

**Clearing:** Map to PCI 10.2 completeness. Approve-to-fix.

**Ingest:** `npm run ingest -- --issue SUB-XX`

**What you should see:** Remediator writes rejects into the audit ledger. CAB checks rejected rows exist. Do not merge.

**SDLC in this run:** Same six beats. The story is we do not only log the wires that worked.

---

### Practice 3 — Idempotency key is ignored

**The bug.** `TransferRequest` has optional `idempotencyKey`. `submitTransfer` ignores it. Two posts with the same key create two transfers and two ids. Test: `practice 3: same idempotencyKey returns the same transfer id`.

**Linear title:** `Duplicate ACH originations — honor idempotencyKey`

**Linear body (paste):**

```
[repo=subtub98/harbor-solutions]

## Control
Payments idempotency. If idempotencyKey is present, a second submitTransfer with the same key must return the first transfer id and must not create a second accepted transfer.

## Evidence
payments/src/transfer.ts comments that idempotencyKey is ignored.
payments/test/control-gap.test.ts → "practice 3: same idempotencyKey returns the same transfer id"

## Policy
- Fix only this gap.
- New branch, PR into main, do not merge, do not mark Linear Done.
```

**Clearing:** Duplicate-wire risk. Same workflow, not a PCI field this time.

**Ingest:** `npm run ingest -- --issue SUB-XX`

**What you should see:** A cache keyed by `idempotencyKey`. Practice 3 test green. Other gaps still failing unless you already merged 1 and 2.

**SDLC in this run:** Same loop. Shows the machinery is not locked to PCI-DSS 10.2 amount.

---

### Interview demo — Audit log reads are not recorded

**The bug (leave this failing until the live session).** PCI-DSS 10.2 also requires logging **who accessed the audit trail**. `listAuditLog(actor)` takes an actor and throws it away. `GET /audit?actor=` does the same. Test: `demo: reading the audit log records the reader`.

**Linear title:** `PCI-DSS 10.2: GET /audit does not log who read the audit trail`

**Linear body (paste):**

```
[repo=subtub98/harbor-solutions]

## Control
PCI-DSS 10.2 — log access to audit trails. listAuditLog / GET /audit?actor= must record { actor, timestamp } so listAuditReads() includes that officer.

## Evidence
payments/src/transfer.ts listAuditLog discards actor.
payments/test/control-gap.test.ts → "demo: reading the audit log records the reader"

## Policy
- Fix only this gap.
- New branch, PR into main, do not merge, do not mark Linear Done.
- Bugbot reviews bugs. CAB reviews this control. Human merges.
```

**Night before:** File this ticket in harbor. Leave it Todo. Confirm `npm test` still fails the demo test on `main`. Confirm practice PRs were **not** used to fix this gap. Cursor Web: Filter → Source → SDK. Clearing plugins Installed. SUB-8 and PR #1 bookmarked as the already-shipped example.

**20 minutes**

| Minutes | What you do | What you say |
| --- | --- | --- |
| 0–3 | Linear harbor + SUB-8 | Work starts as a control ticket. We already closed amount-on-audit (PR #1). Agents never Done, never push main. |
| 3–6 | Clearing on SUB-8 (existing thread) | Grok Bot = triage teammate. Linear + GitHub plugins. It does not write production code. |
| 6–8 | PR #1 | Remediator opened this as cursor[bot]. CAB = control review. Bugbot = bugs. I had to Approve. That was release. |
| 8–16 | **Live:** Clearing on the audit-read ticket, then `npm run ingest -- --issue SUB-XX` | Same pipeline, new bug. Stream in the terminal. SDK agents under Filter → Source → SDK. |
| 16–18 | New PR + Linear In Review | Reader logging added. Branch is not main. Merge is me, later. |
| 18–20 | **Live-extend** | Ask the remediator: open a child Linear ticket for quarterly PCI attestation of audit-log access, and add one runbook sentence. Still no push to main. |

If ingest is slow, start it at minute 8 right after you send Clearing to triage, and keep talking through PR #1 while it runs.

**If they ask to extend:** child attestation ticket + runbook line. Do not start a fifth product.

**Limitations to say out loud**

- Trigger is a CLI, not a Linear webhook (demo reliability).
- First clone failed until `main` existed on GitHub.
- Bugbot may not have commented before merge on PR #1; CAB still did.
- Native Linear → @Cursor would skip our SDK orchestrator and fail this exercise.
- Harbor ACH is not a real ledger. Four small control gaps, one workflow.
- `npm test` fails on every still-open seeded gap. A PR is allowed to leave the others red.

---

## Links to click in the room

- Linear project: https://linear.app/subbu-iyer/project/harbor-3e674a0b312a
- SUB-8: https://linear.app/subbu-iyer/issue/SUB-8/pci-dss-102-ach-transfers-omit-amount-from-the-audit-log
- PR #1: https://github.com/subtub98/harbor-solutions/pull/1
- Repo: https://github.com/subtub98/harbor-solutions
- Clearing prompt: `grok-bot/CLEARING.md`
