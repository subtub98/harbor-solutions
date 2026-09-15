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

Practice with the **click-by-click** section below (which app, what to paste into Clearing, when to ingest, when to close the PR). Do not merge practice PRs. Do not complete `demo:interview` before the live session.

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
2. **Open-PR GitHub Action** — `.github/workflows/open-pr-on-push.yml`. Every **push** of a human/IDE commit on a non-`main` branch opens a PR into `main` if one is not already open. Skips `cursor[bot]` and `cursor/fix-*` so it does not race the remediator. Does not merge. Local commits that never get pushed cannot open a GitHub PR.
3. **Linear MCP** on those cloud agents — they can comment on tickets.
4. **`autoCreatePR`** — remediator opens the GitHub PR.
5. **Bugbot** — PR review automation + `.cursor/BUGBOT.md`.
6. **Hooks** — cloud agents load `.cursor/hooks.json`. Any `git` command that tries to push, check out, or merge `main` is denied.
7. **Cursor rule** `harbor-change-control.mdc` — same policy in the prompt layer.
8. **GitHub branch protection** — `main` cannot take a direct push; merge needs a PR + your approval.
9. **Grok Bot plugins** — Clearing can read/write Linear and read GitHub without you clicking around.

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

## Every run, click by click (use this for practice 1–3 and the interview)

Only the **create command** and **ticket id** change. Everything else is identical. Do not skip windows. Do not let Clearing run ingest. Do not merge.

### Windows to have open before you start

Open these five and leave them open. You will tab, not hunt.

1. **Terminal** in this repo: `cd "/Users/subbuiyer/Desktop/SDK Challenge v1"` (or the clone of `harbor-solutions`). Confirm `.env` exists with `CURSOR_API_KEY` and `LINEAR_API_KEY`.
2. **Linear** project harbor: https://linear.app/subbu-iyer/project/harbor-3e674a0b312a
3. **GitHub** PRs: https://github.com/subtub98/harbor-solutions/pulls
4. **Grok Bot** desktop/web app, bot **Clearing** already selected (do not create a second bot).
5. **Cursor Web** agents: https://cursor.com/agents → top **Filter → Source → SDK**. The default list hides SDK agents. You will need this the moment ingest starts.

Also keep SUB-8 and PR #1 bookmarked so you can show a finished loop without waiting:

- https://linear.app/subbu-iyer/issue/SUB-8/pci-dss-102-ach-transfers-omit-amount-from-the-audit-log
- https://github.com/subtub98/harbor-solutions/pull/1

### Do not do these (they break the story)

- Do not file the Linear ticket by hand. Use `npm run demo:practice-*`.
- Do not run `npm run demo` (retired).
- Do not run ingest without the extra `--`: it must be `npm run ingest -- --issue SUB-XX`.
- Do not tell Clearing “go fix it” or “run ingest.” You run ingest in the terminal.
- Do not use Cursor IDE Agent / Composer to patch `payments/` during practice. The SDK remediator must do it.
- Do not use Linear’s native “assign to Cursor.” That skips our orchestrator.
- Do not merge the practice PR. Do not click **Done** on Linear.
- Do not re-run a `demo:*` command if that ticket already exists (creates duplicates). Practice 1 already has **SUB-9**.
- Close leftover junk PRs first (example: draft **PR #4** redoing SUB-8 amountCents). Close without merging.

### Before step 1 — prove the gap is still on `main`

Cloud agents clone **GitHub `main`**, not your laptop. If the four bugs are only on this feature branch, ingest will “fix” nothing useful.

1. In the terminal: `git fetch origin && git log origin/main -1 --oneline`
2. `npm test` — you want **four failing** tests (practice 1, 2, 3, interview/audit-read) and the original **amountCents test green**.
3. If `origin/main` does not have the four seeded bugs yet, merge/push this branch to `main` via a human PR **before** practicing ingest. Do not start ingest until that is true.

---

### Step 0 — Decide which practice (30 seconds)

| Practice | Create command | Skip create if this ticket already exists | Bug you will talk about |
| --- | --- | --- | --- |
| 1 | `npm run demo:practice-1` | **SUB-9** | No max ACH amount |
| 2 | `npm run demo:practice-2` | (none yet unless you already ran it) | Rejects skip audit log |
| 3 | `npm run demo:practice-3` | (none yet unless you already ran it) | `idempotencyKey` ignored |
| Interview | `npm run demo:interview` | Do **not** practice this to completion if you want it failing in the room | Audit reads not logged |

Pick **one**. Finish it. Then close the PR without merging. Then you may start the next.

Say out loud (practice this sentence): *“Plan starts in Linear, not in the IDE. I’m filing the finding first.”*

---

### Step 1 — Create the Linear ticket (Plan)

**App:** Terminal only. Do not open Grok Bot yet.

1. Make sure you are in the repo root (the folder that has `package.json` with the `demo:practice-1` script).
2. Run **only** the create command for this practice, for example:

```bash
npm run demo:practice-1
```

3. Wait ~2–5 seconds. You are **not** launching cloud agents. If you see remediator/tool stream, you ran ingest by mistake — Ctrl+C.

**What the terminal prints** (ids will differ):

```
Harbor SDLC · repo https://github.com/subtub98/harbor-solutions · Linear project harbor
Created SUB-XX: https://linear.app/subbu-iyer/issue/SUB-XX/...

SDLC Plan — ticket is in Linear (Backlog). GRC work started outside the IDE.

Next, SDLC Triage — paste this to Clearing in Grok Bot:

Triage Linear SUB-XX in project harbor against GitHub subtub98/harbor-solutions.
Comment on SUB-XX with blast radius, control, and recommended next step.
Do not change code, do not merge, do not set Done. Ask me before anyone remediates.

If Clearing asks In Review vs Done, pick In Review.

Then, SDLC Build — after you approve out loud:
  npm run ingest -- --issue SUB-XX

This ticket came from npm run demo:practice-1.
```

4. **Copy four things** from that output into a scratch note (or leave the terminal visible):
   - The id (`SUB-12` etc.)
   - The Linear URL
   - The exact 3-line “Triage Linear SUB-XX…” block (that is what you paste into Grok Bot)
   - The ingest line (you will run it later; do not run it now)

5. **App: Linear.** Click the URL. Confirm:
   - Project is **harbor**
   - Title matches this practice (see tables below)
   - Labels include `sdlc:control-gap`, `Bug`, `risk:high` (PCI tickets also `control:pci-10.2`)
   - State is **Backlog** / **Todo**, **not** In Progress yet
   - Description has `[repo=subtub98/harbor-solutions]` and “Fix only this gap”

**If create failed:** usually missing `LINEAR_API_KEY` in `.env`, or you are not in the repo. Do not paste a handmade ticket into Linear to “save time.”

**SDLC:** Plan. GRC filed a finding. Coding has not started.

---

### Step 2 — Open Grok Bot and triage (Triage)

**App: Grok Bot.** Not Cursor. Not Linear’s comment box. Not ChatGPT.

1. Switch to the **Grok Bot** app.
2. In the left sidebar, click the existing bot named **Clearing**. Do **not** click New → Create new agent. That bot already has Linear + GitHub plugins and the profile from `grok-bot/CLEARING.md`.
3. Start a **new chat** with Clearing (new thread for this ticket). Do not continue the old SUB-8 retrospective thread — it will talk about PR #1 and amountCents.
4. Confirm plugins on Clearing still show **Linear** and **GitHub** as installed. If GitHub asks for a token again, that is the classic PAT with `repo` scope (do not paste the token into the chat).
5. Paste **exactly** the three-line block from the terminal, with the real id. Example if the command created SUB-12:

```
Triage Linear SUB-12 in project harbor against GitHub subtub98/harbor-solutions.
Comment on SUB-12 with blast radius, control, and recommended next step.
Do not change code, do not merge, do not set Done. Ask me before anyone remediates.
```

6. Send. Wait. You should see Clearing **use the Linear plugin** (read issue) and **GitHub plugin** (read `payments/` on `main`). This can take 30–90 seconds. Do not interrupt unless it is clearly stuck.

**What Clearing should do:**

- Summarize the gap in chat (blast radius, control, whether `main` still has it).
- **Comment on the Linear issue** (you will verify in step 2b).
- **Ask you** before anyone remediates. That question is the point.

**What Clearing must not do:**

- Edit files, open a PR, merge, mark Linear **Done**, or run `npm run ingest`.
- If it offers to “just fix it” or “assign to Cursor,” reply:

```
Do not change code. Do not run ingest. Comment on the Linear ticket only, then wait. I will approve remediation out loud and I will run ingest myself.
```

7. If Clearing asks **In Review vs Done** this early (there is no PR yet), say:

```
Leave it in Backlog/Todo until ingest starts. After a PR exists, In Review — never Done.
```

**Say out loud:** *“Clearing is intake. Same role as a teammate on Slack. It cannot attest a control and it cannot touch production.”*

---

### Step 2b — Prove triage landed on Linear

**App: Linear.** Refresh the issue.

1. You should see a new comment from Clearing: severity, control, evidence, recommended next step.
2. Status should still **not** be Done.
3. There should still be **no GitHub PR** for this ticket. If a PR appeared, something else (IDE agent, native Linear Cursor, leftover ingest) ran — stop and close that PR without merging.

**SDLC:** Triage / design. Next step is a human go-ahead.

---

### Step 3 — You approve out loud (change approval)

Still **no ingest** until you say it.

1. In Grok Bot, if Clearing is waiting, reply with this (and say it out loud as if interviewers are in the room):

```
Approved. Remediate this ticket only. I will run ingest from the Harbor CLI. Do not merge, do not push main, do not set Linear Done. After the PR exists the ticket stays In Review.
```

2. Do **not** ask Clearing to start the remediator.
3. **App: Cursor Web** now, before you type ingest: https://cursor.com/agents → **Filter → Source → SDK**. Leave this tab open. The remediator will appear here, not in the default agent list.

**SDLC:** CAB / manager approval. Agents do not self-approve.

---

### Step 4 — Ingest (Build, then Verify)

**App: Terminal** (same repo). **App: Cursor Web** (SDK filter) beside it.

1. Copy the ingest line from step 1. The extra `--` is required. Example:

```bash
npm run ingest -- --issue SUB-12
```

Wrong (npm eats `--issue`, usage error):

```bash
npm run ingest --issue SUB-12
```

2. Hit enter. Leave it running. Do not Ctrl+C unless you are aborting a bad ticket (wrong SUB id, or it is remediating SUB-8 again).
3. First lines should look like:

```
Harbor SDLC · repo https://github.com/subtub98/harbor-solutions · Linear project harbor
Issue SUB-12: https://linear.app/...
[remediator] agent bc-...
[remediator] run run-...
```

Then a stream of assistant text and `[remediator] tool ...` lines. This is **Build**. It often takes **several minutes**.

4. **App: Linear** (optional while waiting): refresh. Status should have moved to **In Progress**.
5. **App: Cursor Web** (SDK filter): you should see `harbor-remediator-SUB-12` (name uses the id). Click it if you want the nicer UI; the terminal stream is enough to talk over.
6. Do **not** click Merge, Approve, or “apply on main” anywhere in Cursor Web.
7. When the remediator finishes, the terminal prints a PR URL (or the orchestrator comments it on Linear). Then it starts **`[reviewer]`** — second agent. That is **Verify** (CAB). Wait for that too. Do not kill the process after the PR appears.
8. Terminal end state:

```
Done.
  issue    https://linear.app/...
  branch   cursor/fix-sub-...   (must NOT be main)
  pr       https://github.com/subtub98/harbor-solutions/pull/N
  review   bc-...
```

If **branch is `main`**: the orchestrator should have aborted. If it did not, do not merge anything. Treat it as a failed run.

9. If ingest errors with clone / `Branch 'main' does not exist`: `main` is missing on GitHub. Stop. That was the first demo failure mode.
10. If ingest clones `main` but the remediator says the gap is already fixed: the four bugs never landed on `main`, or a previous practice PR was merged. Stop. Do not keep generating amountCents PRs (that is how **PR #4** happened).

**SDLC:** Build = remediator new branch + PR as **cursor[bot]**. Verify = CAB reviewer + Bugbot + checks. Hook + `workOnCurrentBranch: false` keep this off `main`.

---

### Step 5 — GitHub PR (look, do not merge)

**App: GitHub.** Click the `pr` URL from the terminal, or https://github.com/subtub98/harbor-solutions/pulls

1. Author must be **cursor[bot]**, not you. If it is you, you used the IDE or a personal clone — wrong story, close it.
2. Base: `main`. Compare branch: `cursor/fix-...` (not `main`).
3. It often opens as **Draft**. Click **Ready for review**. That is a GitHub UI click, not a merge.
4. **Files changed:** only this practice’s gap (see tables below) plus maybe `payments/RUNBOOK.md`. If it also “helpfully” fixed practice 2, 3, and interview in one PR, say that is a miss against the ticket policy. For practice you still **do not merge**. You can close it.
5. **Conversation tab:** look for **Harbor CAB review — PASS** or **BLOCK** from the reviewer agent. That comment is **not** a GitHub Approve.
6. **Bugbot:** may comment by itself. If it does not, on the PR conversation box type exactly:

```
bugbot run
```

and send. Wait. If it still never comments, that is a known limitation — CAB still covered controls. Say that out loud.
7. Checks: wait until they go green or note they are still running.
8. **Optional practice of branch protection:** click **Review changes → Approve → Submit review**. You **can** Approve because you are not the author (cursor[bot] is).
9. **Do not click Merge.** Do not click Squash and merge. Practice PRs stay unmerged so `main` keeps the other seeded bugs.
10. After you have seen CAB + (optional) Approve, click **Close pull request**. Confirm. Do **not** delete the remote branch if you want to show it later; closing is enough. Linear stays **In Review**.

**App: Linear.** Refresh.

- Status **In Review** (orchestrator set this after CAB).
- Comments: “Remediation started” (branch + PR) and “Change control packet” (both agent ids, “human merges”).
- If Clearing or anyone offers Done: type in Grok Bot or Linear: **In Review**. Never Done.

**Say out loud:** *“Release is me merging a protected main. Closing Linear to Done is a GRC attestation. Neither is an agent job. For practice I am not merging so the other gaps stay on main.”*

**SDLC:** Release (you would merge in a real change). In practice you stop before merge.

---

### Step 6 — Operate (optional; do this on one practice, required in the interview if they ask)

Only after the PR exists. **App: Grok Bot**, same Clearing chat, or a new Clearing message:

```
Create a child Linear ticket under SUB-XX in project harbor for the next quarterly PCI attestation of this control. Do not mark either ticket Done. Do not change code.

Then suggest one sentence we would add to payments/RUNBOOK.md for this control. Do not edit the file yourself unless I ask, and if you ever edit it must be on a new branch and PR — never main.
```

Expect: a child issue in harbor, still not Done. You can also ask the remediator in a **new ingest** only if they demand a code change — usually Clearing + child ticket is enough.

**SDLC:** Operate. Evidence and the next attestation exist after the code change.

---

### After each practice — reset for the next one

1. Practice PR **Closed**, not merged.
2. Linear ticket **In Review**, not Done.
3. `npm test` still fails the **other** gaps (and this one too, because you did not merge).
4. New Clearing **thread** for the next ticket.
5. Do not re-create the same gap ticket.

| Step | App | You do | SDLC |
| --- | --- | --- | --- |
| 0 | Terminal / Linear | Pick one gap; skip create if ticket exists | — |
| 1 | Terminal, then Linear | `npm run demo:…` ; open the URL | Plan |
| 2 | Grok Bot → Clearing | New chat; paste the 3-line triage block | Triage |
| 2b | Linear | Confirm Clearing’s comment | Triage |
| 3 | Grok Bot + mouth | “Approved. I will run ingest.” | Change approval |
| 4 | Terminal + Cursor Web SDK filter | `npm run ingest -- --issue SUB-XX` | Build + Verify |
| 5 | GitHub, then Linear | Ready for review, optional Approve, **Close** (no merge), In Review | Release (stopped) |
| 6 | Grok Bot | Child attestation ticket | Operate |

---

## Practice 1 — No maximum ACH amount

Run the click-by-click above. Only these details change.

**The bug (say this):** `payments/src/limits.ts` has `MIN_CENTS` and no max. `submitTransfer` of `5_000_000_000` cents is accepted. Test name: `practice 1: ACH amount has a maximum of 100_000_000 cents`.

**Create:**

```bash
npm run demo:practice-1
```

**If SUB-9 already exists** (it does from the first seed): **do not run create again.** Skip to Linear, copy SUB-9’s id, and use this as the Clearing paste:

```
Triage Linear SUB-9 in project harbor against GitHub subtub98/harbor-solutions.
Comment on SUB-9 with blast radius, control, and recommended next step.
Do not change code, do not merge, do not set Done. Ask me before anyone remediates.
```

Then ingest:

```bash
npm run ingest -- --issue SUB-9
```

**Ticket title to expect:** `No maximum ACH amount — reject over 100_000_000 cents`  
**Labels:** `sdlc:control-gap`, `Bug`, `risk:high` (no `control:pci-10.2` — this is a fraud/ops limit, not the audit control).

**Clearing should mention:** unlimited wires / fraud / ops cap of $1,000,000 (100_000_000 cents). Recommended next step = you run ingest after approval.

**PR files to expect:** `payments/src/limits.ts` (reject above 100_000_000), maybe `transfer.ts` if reject lives there, maybe `RUNBOOK.md`. Must **not** require fixing audit-read / idempotency / rejected-audit.

**When you Close the PR:** `main` still has no max. That is correct. You proved the loop.

---

## Practice 2 — Rejected transfers skip the audit log

Same click-by-click. Do this **after** practice 1 is closed unmerged.

**The bug (say this):** `reject()` in `payments/src/transfer.ts` returns without `recordTransfer`. Same-account, missing fields, and invalid amount never hit the audit log. PCI-DSS 10.2 is completeness of attempts, not only successes. Test: `practice 2: rejected transfers are written to the audit log`.

**Create:**

```bash
npm run demo:practice-2
```

**Always run create** unless you already see a harbor ticket with this exact title. Then paste Clearing’s 3-line block with the **new** id from the terminal (not SUB-8, not SUB-9).

**Ingest** (replace with the printed id):

```bash
npm run ingest -- --issue SUB-XX
```

**Ticket title:** `PCI-DSS 10.2: rejected ACH transfers are not audited`  
**Labels:** `sdlc:control-gap`, `control:pci-10.2`, `Bug`, `risk:high`.

**Grok Bot:** new Clearing thread. If you paste into the practice-1 thread, it will mix SUB-9 and this ticket.

**PR files to expect:** `payments/src/transfer.ts` (rejected rows get `recordTransfer` / status rejected + reason), maybe `audit.ts` / types / `RUNBOOK.md`. Other gap tests may still fail — that is allowed.

**Close without merging.**

---

## Practice 3 — Idempotency key is ignored

Same click-by-click. New Clearing thread. New ticket.

**The bug (say this):** `idempotencyKey` is on the request type and ignored. Two `submitTransfer` calls with `idempotencyKey: "wire-practice-3"` mint two ids. Duplicate ACH originations. Test: `practice 3: same idempotencyKey returns the same transfer id`.

**Create:**

```bash
npm run demo:practice-3
```

**Ingest** with the new id from the terminal.

**Ticket title:** `Duplicate ACH originations — honor idempotencyKey`  
**Labels:** `sdlc:control-gap`, `Bug`, `risk:high`.

**PR files to expect:** `payments/src/transfer.ts` (store key → first transfer id), maybe `RUNBOOK.md`. Must not silently implement the interview audit-read gap.

**Close without merging.** Leave the **interview** test failing on `main`.

---

### If something goes wrong mid-practice

| What you see | What you do |
| --- | --- |
| `Usage: tsx src/run.ts ...` | You dropped the extra `--`. Re-run `npm run ingest -- --issue SUB-XX`. |
| Duplicate Linear tickets for the same gap | Stop creating. Pick the first id. Cancel/ignore the extras. Do not ingest twice. |
| PR titled like SUB-8 / amountCents again | Close without merging. You ingested the closed gap or `main` already has amount. |
| Remediator fixed all four tests in one PR | Still do not merge. Say the prompt said one gap. Close. |
| Clearing wrote code or tried ingest | Stop it. Paste: do not change code; I run ingest. |
| Cursor Web empty | Filter → Source → SDK. |
| Draft PR, no CAB comment yet | Wait for the terminal `[reviewer]` to finish. Do not Ctrl+C. |
| You cannot Approve | Author is you, not cursor[bot]. Wrong PR. Close it. |
| Merge button works and you almost click it | Walk away. Practice = Close. |
| Linear jumped to Done | In Clearing: move it back to **In Review**. That is policy, not a mistake to hide. |

---

## Interview — Audit log reads are not recorded

Follow the **click-by-click** above. Same apps, same pastes, same “I run ingest / never Done / never merge.” Only the command and the bug change. Do not skip Grok Bot because you are nervous about time — start ingest the moment you say “approved,” then keep talking over SUB-8 / PR #1 while it streams.

**Bug (leave failing until the live session):** `listAuditLog(actor)` discards the reader. PCI-DSS 10.2 also logs who accessed the audit trail. Test: `demo: reading the audit log records the reader`.

**Create in the room (not the night before):**

```bash
npm run demo:interview
```

Copy the printed `SUB-XX`, paste the 3-line triage block into a **new Clearing chat**, say approved, then:

```bash
npm run ingest -- --issue SUB-XX
```

**Night before:** Confirm this test still fails on `main`. Confirm practice PRs did not “helpfully” fix it (none merged). Cursor Web Filter → Source → SDK. Clearing plugins Installed. SUB-8 and PR #1 bookmarked. Close junk drafts (like PR #4). Five windows already open.

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

---

## During the live session — come prepared to

These are the five things the interview scores. Say the Harbor version of each, then click.

### Explain the problem you chose and why it matters in an enterprise context

**Problem:** In a bank, a PCI / SOX control gap is not a GitHub issue. It is a finding. It has an owner, evidence, a change window, and a human who attests it closed. Native “assign to Cursor” skips that. An agent that pushes `main` would fail an audit.

**Why Harbor:** Tiny ACH API (`POST /transfers`, `GET /audit`) so the code is simple. The product is the **SDLC loop**: Linear ticket → Clearing triage → SDK remediator on a new branch → PR as cursor[bot] → Bugbot + CAB review → **you** merge. Linear stays **In Review**, never Done by an agent.

**Enterprise mapping:** GRC files the finding (Plan). A teammate triages (Clearing). Engineering remediates off `main`. Independent review (Bugbot bugs, CAB controls). Change advisory / you release. Operate is the runbook + attestation child ticket.

### Walk through your working prototype — demo it live, not via slides

Do not present slides. Click this loop:

1. Linear project **harbor** + SUB-8 + [PR #1](https://github.com/subtub98/harbor-solutions/pull/1) (already closed: amount on the audit log).
2. `npm run demo:interview` — ticket appears. That is Plan, live.
3. Paste the printed prompt into **Clearing**. That is Triage, live.
4. `npm run ingest -- --issue SUB-XX`. Cursor Web → Filter → Source → SDK. That is Build + Verify, live.
5. New PR from cursor[bot], Linear **In Review**. You do not merge in the room unless they ask.

Three practice commands (`demo:practice-1` … `3`) exist so you already did this once. The interview gap is audit-log **reads** not recorded.

### Discuss key design decisions and trade-offs

| Decision | Trade-off |
| --- | --- |
| **SDK orchestrator**, not Linear “assign to Cursor” | More moving parts. Policy, retries, and audit live in **our** code, which is the exercise. |
| **CLI trigger**, not a Linear webhook | A missed webhook cannot kill a 20-minute session. Real product would add the webhook later. |
| **Two cloud agents** (remediator + CAB) plus **Bugbot** | Roles stay separate: write code / review controls / hunt bugs. One agent doing all three would look like self-attestation. |
| **Clearing is Grok Bot**, not an SDK coder | Intake can read Linear + GitHub without touching `main`. Mixing triage and patch is how you get silent prod writes. |
| **`workOnCurrentBranch: false` + hook + branch protection** | Three layers against `main`. Redundant on purpose. Banks want defense in depth. |
| **Never Linear Done** | Looks unfinished. Closing Done is a human GRC attestation, not an agent job. |
| **Four small gaps, one workflow** | Not a core banking platform. Graded on the loop, not the ledger. |
| **cursor[bot] as PR author** | You can Approve (you cannot Approve your own PR). Merge is still you. |

### Highlight limitations and how you would evolve the solution

**Limitations (say these):**

- Trigger is a CLI, not a Linear webhook.
- First clone failed until GitHub `main` existed.
- Bugbot may not comment before merge; CAB still did on PR #1.
- Harbor ACH is in-memory, not a real ledger.
- `npm test` stays red on every still-open seeded gap; a PR may leave the others failing.
- You cannot Approve a PR you authored; agent PRs are cursor[bot] so you can Approve those.

**How we would evolve:**

- Linear webhook (or Cursor automation) starts ingest instead of the terminal.
- Persist audit to a real store; add amount, rejects, idempotency, and audit-read as one control pack.
- CAB as a required GitHub check, not only a comment.
- Promotion path: In Review → human Done with attached evidence, still never by an agent.
- Same orchestrator reused for other control families (SOX change, access recertification), not more ACH features.

### Extend a part of your prototype based on a prompt from the interviewers

Planted live-extend (do this if they ask, or offer it at minute 18):

- Child Linear ticket: **quarterly PCI attestation** for the control just closed. Do not set Done.
- One new sentence in `payments/RUNBOOK.md` on that control.
- Still **no push to `main`**. New branch / PR only.

If they ask something else, keep the same policy: ticket first (or comment on the open ticket), branch off `main`, PR, Linear In Review, you merge later. Do not start a fifth product.
