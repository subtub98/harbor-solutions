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

The seeded problem was **PCI-DSS 10.2**: every transfer audit record must include actor, accounts, timestamp, **and amount**. On the first version of `main`, `payments/src/audit.ts` dropped `amountCents`. A test in `payments/test/control-gap.test.ts` failed on purpose to prove it. That was the “patient.” The SDK pipeline was the “doctor.”

That gap is **already closed on `main`**. We ran the pipeline once, opened PR #1, you approved it, and it was merged. The rest of this doc is both a record of that run and a script for showing it again.

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
npm run ingest -- --issue SUB-8   # run the pipeline on an EXISTING Linear ticket
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
- Prompt: fix `audit.ts`, make tests pass, update the runbook, cite the Linear issue, never merge, never mark Done
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

Known leftover: `npm test` in the README still says the PCI test fails on `main`. After the merge, that test should **pass** on `main`. If you show `npm test` in the interview on current `main`, it should be green. That is success, not a bug.

---

## What is still true on `main` (useful for practice)

PCI 10.2 amount is **fixed**. `payments/src/limits.ts` still only checks a **minimum** amount. There is no maximum wire size. That is a clean second control gap if you need a live coding demo that is not SUB-8 again.

---

## Three practice runs (same workflow)

Do these before the interview. Use **new Linear tickets** in project harbor. Do not merge practice PRs if you still want a gap sitting on `main` for the interview. You can close the practice PRs without merging.

### Practice 1 — Clearing only (no SDK)

**Goal:** Prove Grok Bot is intake, not a coder.

1. In Linear harbor, create a ticket: “Confirm PCI-DSS 10.2 audit fields after SUB-8 merge.”
2. In Grok Bot, tell Clearing: read this ticket and `main`, comment whether the control is closed, do not change code, do not set Done.
3. Confirm a comment lands on Linear.
4. If it asks to mark Done, choose **In Review**.

Success: a Linear comment, no new branch, no PR.

### Practice 2 — Docs / runbook only (full pipeline, small diff)

**Goal:** Prove ingest works when the change is operational, not a scary code rewrite.

1. File Linear: “RUNBOOK: document that agents must not push main, and link SUB-8 / PR #1.”
2. Labels: `sdlc:control-gap` is fine, or skip PCI if it feels wrong.
3. Ask Clearing to triage and wait for your approval.
4. `npm run ingest -- --issue SUB-XX`
5. Watch remediator open a PR that only touches `payments/RUNBOOK.md` (or similar). CAB should still PASS/BLOCK. You do **not** merge.

Success: PR exists, Linear In Review, branch is not `main`.

### Practice 3 — New code control gap (full pipeline)

**Goal:** Muscle memory for a real fix, since SUB-8 is already merged.

1. File Linear: “ACH transfers have no maximum amount in `payments/src/limits.ts`.”
2. Clearing triages (operational / PCI-adjacent limit, blast radius = large wires).
3. `npm run ingest -- --issue SUB-XX`
4. Confirm a new branch + PR adds a max (pick a number in the ticket, e.g. $1,000,000 cents = 100000000) and a test.
5. Look for Bugbot and the CAB comment.
6. Approve in GitHub if you want to practice the protection UI. **Do not merge** if this is the gap you want live in the interview. Or merge it, and use Practice 2’s runbook ticket as the live-extend instead.

Success: you can narrate Plan → Build → Verify without reading notes.

---

## The actual interview demo (use this one)

Do **not** re-ingest SUB-8 as the live coding beat. Walk SUB-8 and PR #1 as **proof this already worked in production-shaped tooling**, then run **one new ticket** live so they see agents move.

**Prep the night before**

- `main` exists, protection is on, `.env` keys work, Clearing plugins are Installed.
- File (but do not ingest) a Linear ticket in harbor: **“No maximum ACH amount in limits.ts — add a ceiling and a test.”** Put the exact max in the description. Label it. Leave it Todo.
- Have SUB-8 and PR #1 bookmarked.
- Cursor Web ready with Filter → Source → SDK.

**20 minutes**

| Minutes | What you do | What you say |
| --- | --- | --- |
| 0–3 | Linear harbor + SUB-8 | Banks don’t start in the IDE. Work starts as a control ticket. PCI-DSS 10.2. We never auto-Done. |
| 3–6 | Clearing thread | Grok Bot is the teammate for triage. Plugins: Linear + GitHub. It does not write production code. |
| 6–10 | PR #1 | Cursor SDK remediator opened this as cursor[bot] from a new branch. CAB comment is the control review. Bugbot is the bug review. I had to Approve. Protection blocked merge. I merged. That was release. |
| 10–16 | **Live:** Clearing on the new max-amount ticket, then `npm run ingest -- --issue SUB-XX` | Same loop, live. Remediator then CAB. Point at the streaming tools in the terminal. |
| 16–18 | New PR + Linear In Review | Agents stopped. Human would merge later. Show the branch is not `main`. |
| 18–20 | **Live-extend** (they will ask anyway) | In the PR or a follow-up to the remediator: also open a **child Linear ticket** for quarterly PCI attestation and add one line to the runbook. Still no push to `main`. |

If ingest is too slow for the clock, start ingest at minute 6 in the background after the SUB-8 story, and spend minutes 6–10 on PR #1 while it runs.

**If they ask you to extend:** child attestation ticket + runbook sentence. You already planted that. Do not start a new product.

**Limitations to say out loud**

- Trigger is a CLI, not a Linear webhook (demo reliability).
- First clone failed until `main` existed on GitHub.
- Bugbot may not have commented before merge on PR #1; CAB still did.
- Native Linear → @Cursor would be simpler and would fail this exercise because it skips our SDK orchestrator.
- Harbor ACH is not a real ledger. The control loop is the product.

---

## Links to click in the room

- Linear project: https://linear.app/subbu-iyer/project/harbor-3e674a0b312a
- SUB-8: https://linear.app/subbu-iyer/issue/SUB-8/pci-dss-102-ach-transfers-omit-amount-from-the-audit-log
- PR #1: https://github.com/subtub98/harbor-solutions/pull/1
- Repo: https://github.com/subtub98/harbor-solutions
- Clearing prompt: `grok-bot/CLEARING.md`
