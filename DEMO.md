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

There are **four new seeded bugs**, same shape as SUB-8. Three are practice. One is the interview. Each ticket must fix **only that gap**. Leave the others failing.

Do not file Linear tickets by hand. The four commands below create the right ticket in project **harbor**. Then you triage with Clearing and ingest.

`npm test` fails on the four open gaps until each pipeline closes one. Do not merge practice PRs. Do not merge the interview gap until after the session.

---

## Commands

```bash
npm test                    # payments tests (four gaps fail on purpose)
npm run demo:practice-1     # create Linear ticket: no max ACH amount
npm run demo:practice-2     # create Linear ticket: rejected transfers not audited
npm run demo:practice-3     # create Linear ticket: idempotencyKey ignored
npm run demo:interview      # create Linear ticket: audit reads not logged
npm run ingest -- --issue SUB-XX   # remediator + CAB on that ticket
```

Each `demo:*` command **only creates the Linear ticket** and prints the Clearing paste plus the ingest command. It does **not** start cloud agents. That split is the SDLC: Plan (ticket) → Triage (Clearing) → Build (ingest).

The extra `--` on ingest is required so npm forwards `--issue`.

Push the seeded bugs to `main` before ingest, or cloud agents will clone a tree that does not have them.

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

Commands are listed at the top of this file.

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

1. The first (now retired) combined demo command created **SUB-8**: “PCI-DSS 10.2: ACH transfers omit amount from the audit log.” New tickets use `npm run demo:practice-1` (and the other three commands) instead — ticket only, no agents.
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
2. **Plan.** `npm run demo:practice-1` (or practice-2 / practice-3 / interview) files the Linear issue in project harbor. Labels include `sdlc:control-gap` (PCI tickets also get `control:pci-10.2`). Body includes `[repo=subtub98/harbor-solutions]` and “do not push main.”
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

## Every run, step by step (and the SDLC)

This is the same for practice 1–3 and the interview. Only the Linear ticket (which bug) changes.

### Step 1 — Create the ticket

```bash
npm run demo:practice-1    # or practice-2, practice-3, demo:interview
```

**What happens:** The orchestrator calls Linear’s API and files an issue in project **harbor** with the right title, body, and labels. It prints the `SUB-XX` URL, a Clearing paste, and the ingest command. No cloud agent starts.

**SDLC: Plan.** Work exists in the tracker before anyone opens an IDE. In a bank this is GRC or InfoSec filing a control finding.

### Step 2 — Clearing triages

Paste the printed prompt into **Clearing** (Grok Bot). It reads Linear + GitHub, comments blast radius and control, and asks you to approve a fix. If it offers Done vs In Review, pick **In Review**.

**What happens:** Linear gets a human-readable triage comment. No branch, no PR.

**SDLC: Triage / design.** A teammate (here, Grok Bot) decides severity and next step. Coding has not started.

### Step 3 — You approve out loud

Say the fix can proceed. You are still the change owner.

**SDLC:** CAB / manager go-ahead. Agents do not self-approve.

### Step 4 — Ingest (build + verify)

```bash
npm run ingest -- --issue SUB-XX
```

Use the id from step 1.

**What happens, in order:**

1. Orchestrator loads SUB-XX and sets Linear to **In Progress**.
2. **Remediator** cloud agent clones `main`, creates a **new branch**, fixes only that ticket’s gap, opens a PR as **cursor[bot]**.
3. Orchestrator comments the PR URL on Linear.
4. **CAB reviewer** cloud agent attaches to that PR, posts PASS/BLOCK, does not merge.
5. **Bugbot** (GitHub automation) reviews the PR for bugs when it runs.
6. Orchestrator sets Linear to **In Review** and posts the change-control packet.

**SDLC: Build** is the remediator. **SDLC: Verify** is Bugbot + CAB + GitHub checks. The hook and `workOnCurrentBranch: false` keep this off `main`.

Watch agents: Cursor Web → Filter → Source → SDK.

### Step 5 — You look at the PR (do not merge practice)

Mark ready for review if it is a draft. You may **Approve** (you can, because cursor[bot] is the author). **Do not merge** practice PRs. **Do not merge** the interview PR in the room unless they ask.

**SDLC: Release** is a human merge to protected `main`. Skipping merge in practice keeps the other seeded bugs alive.

### Step 6 — Operate (optional live-extend)

Ask the remediator or Clearing for a **child** Linear ticket (quarterly attestation) and a runbook sentence. Still no push to `main`.

**SDLC: Operate.** Evidence and runbooks stay true after the code change.

| Step | You do | SDLC |
| --- | --- | --- |
| 1 | `npm run demo:…` | Plan |
| 2 | Clearing comments | Triage |
| 3 | You say go | Change approval |
| 4 | `npm run ingest -- --issue SUB-XX` | Build + Verify |
| 5 | Review PR, don’t merge (practice) | Release (human only) |
| 6 | Child ticket / runbook | Operate |

---

## Practice 1 — No maximum ACH amount

**Bug:** `payments/src/limits.ts` has no ceiling. A huge wire is accepted. Test: `practice 1: ACH amount has a maximum of 100_000_000 cents`.

**Command:** `npm run demo:practice-1`  
Then Clearing, then `npm run ingest -- --issue SUB-XX`. If **SUB-9** already exists for this gap, skip the create command and ingest that id instead.

**Expect:** PR edits `limits.ts` to reject above 100_000_000 cents. That test goes green. Other gap tests may still fail. Close the PR without merging.

---

## Practice 2 — Rejected transfers skip the audit log

**Bug:** Rejects never call `recordTransfer`. PCI-DSS 10.2 wants attempts, not only successes. Test: `practice 2: rejected transfers are written to the audit log`.

**Command:** `npm run demo:practice-2`  
Then Clearing, then ingest.

**Expect:** PR writes rejected rows into the audit log. Do not merge.

---

## Practice 3 — Idempotency key is ignored

**Bug:** `idempotencyKey` on the request is ignored; two submits create two transfers. Test: `practice 3: same idempotencyKey returns the same transfer id`.

**Command:** `npm run demo:practice-3`  
Then Clearing, then ingest.

**Expect:** PR honors the key (same id on retry). Do not merge.

---

## Interview — Audit log reads are not recorded

**Bug (leave failing until the live session):** `listAuditLog(actor)` discards the reader. PCI-DSS 10.2 also logs who accessed the audit trail. Test: `demo: reading the audit log records the reader`.

**Night before:** Confirm this test still fails on `main`. Confirm practice PRs did not “helpfully” fix it. Cursor Web Filter → Source → SDK. Clearing plugins Installed. SUB-8 and PR #1 bookmarked.

**In the room**

| Minutes | What you do | SDLC / what you say |
| --- | --- | --- |
| 0–3 | Linear harbor + SUB-8 + PR #1 | Plan/Release already happened once. Amount-on-audit is closed. Agents never Done, never push main. |
| 3–6 | Clearing on SUB-8 | Triage teammate. Linear + GitHub plugins. It does not write production code. |
| 6–8 | `npm run demo:interview` | **Plan (live).** Ticket appears in harbor. Read the printed SUB-XX. |
| 8–10 | Paste Clearing prompt from the terminal | **Triage (live).** |
| 10–16 | `npm run ingest -- --issue SUB-XX` (start this as soon as you say go; keep talking) | **Build + Verify (live).** Remediator then CAB. Stream in the terminal. |
| 16–18 | New PR + Linear In Review | Branch is not main. Merge is later, by you. |
| 18–20 | Live-extend: child attestation ticket + runbook line | **Operate.** Still no push to main. |

If ingest is slow, start it the moment Clearing is done asking, and keep SUB-8 / PR #1 on screen while it runs.

**If they ask to extend:** child attestation ticket + runbook line. Do not start a fifth product.

**Limitations to say out loud**

- Trigger is a CLI, not a Linear webhook (demo reliability).
- First clone failed until `main` existed on GitHub.
- Bugbot may not have commented before merge on PR #1; CAB still did.
- Native Linear → @Cursor would skip our SDK orchestrator and fail this exercise.
- Harbor ACH is not a real ledger. Four small control gaps, one workflow.
- `npm test` fails on every still-open seeded gap. A PR is allowed to leave the others red.
- You cannot Approve a PR you authored. Agent PRs are cursor[bot], so you can Approve those. Human seed PRs need the approval rule toggled off or a second reviewer.

---

## Links to click in the room

- Linear project: https://linear.app/subbu-iyer/project/harbor-3e674a0b312a
- SUB-8: https://linear.app/subbu-iyer/issue/SUB-8/pci-dss-102-ach-transfers-omit-amount-from-the-audit-log
- PR #1: https://github.com/subtub98/harbor-solutions/pull/1
- Repo: https://github.com/subtub98/harbor-solutions
- Clearing prompt: `grok-bot/CLEARING.md`
