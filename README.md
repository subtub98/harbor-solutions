# Harbor Solutions

Cursor SDK prototype: PCI control-gap remediation on a tiny ACH service. Agents **never push to `main`**. They open a branch and a PR. Bugbot reviews bugs; a second SDK bot posts the CAB review. Linear issue stays **In Review**.

## Connect these before the demo

| Need | Where | Status |
| --- | --- | --- |
| Cursor API key | [cursor.com/dashboard/integrations](https://cursor.com/dashboard/integrations) → copy into `.env` as `CURSOR_API_KEY` | You must add |
| GitHub repo | [github.com/subtub98/harbor-solutions](https://github.com/subtub98/harbor-solutions) connected under Cursor Dashboard → GitHub (Cloud Agents + this repo) | Repo exists |
| Bugbot | Cursor Automations → Bugbot → enable `subtub98/harbor-solutions` | You said this is on |
| Linear | Workspace **Subbu Iyer**, project **[harbor](https://linear.app/subbu-iyer/project/harbor-3e674a0b312a)**, team key `SUB` | Connected. Labels `sdlc:control-gap` and `control:pci-10.2` exist |
| Linear API key | Linear → Settings → Security & access → API → `.env` as `LINEAR_API_KEY` | You must add |
| Protect `main` | GitHub repo → Settings → Branches → require PR, no direct push | Recommended |
| Grok Bot | App: create **Clearing**. Plugins: Linear + GitHub. Prompt in `grok-bot/CLEARING.md` | Do this now |

Copy `.env.example` to `.env`. Do not commit `.env`.

Cloud agents started from the SDK are hidden in the default agent list. In Cursor Web: Filter → Source → SDK.

## Run

```bash
npm install
npm test                       # four seeded gaps fail on purpose
npm run demo:practice-1        # create Linear ticket only (max amount)
npm run demo:practice-2        # create Linear ticket only (rejected audit)
npm run demo:practice-3        # create Linear ticket only (idempotency)
npm run demo:interview         # create Linear ticket only (audit-read)
npm run ingest -- --issue SUB-XX
```

Each `demo:*` command files the matching Linear issue on **harbor** and prints a Clearing paste plus the ingest command. It does **not** start cloud agents.

`npm run ingest -- --issue SUB-XX` then:

1. Loads that ticket and sets Linear **In Progress**.
2. Launches a **cloud remediator** with `workOnCurrentBranch: false` and `autoCreatePR: true`.
3. Aborts if the agent reports branch `main`.
4. Launches a **cloud reviewer** attached to the PR (`prUrl`). Comment only; no second PR.
5. Moves Linear to **In Review**. Bugbot comments on the GitHub PR on its own.

Step-by-step SDLC mapping: `DEMO.md`.

## Layout

- `payments/` — ACH API (`audit.ts` is the seeded gap)
- `orchestrator/` — Cursor SDK pipeline
- `.cursor/BUGBOT.md` — Bugbot rules
- `.cursor/hooks.json` — deny `git push/checkout/merge main` for cloud agents

## Live-extend

Ask the agent to update `payments/RUNBOOK.md` and open a child Linear ticket for the quarterly PCI attestation. Still no push to `main`.
