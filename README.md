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
| Grok Bot (optional live layer) | Grok Bot plugins: GitHub + Linear. Standing job: triage Harbor tickets, never merge | Optional for the interview |

Copy `.env.example` to `.env`. Do not commit `.env`.

Cloud agents started from the SDK are hidden in the default agent list. In Cursor Web: Filter → Source → SDK.

## Run

```bash
npm install
npm test          # currently fails: seeded PCI 10.2 gap on main
npm run demo      # create Linear ticket in harbor + remediate + CAB review
npm run ingest -- --issue SUB-12
```

`npm run demo` will:

1. File a Linear issue on **harbor** (`PCI-DSS 10.2`, labels `sdlc:control-gap`, `control:pci-10.2`).
2. Launch a **cloud remediator** with `workOnCurrentBranch: false` and `autoCreatePR: true`.
3. Abort if the agent reports branch `main`.
4. Launch a **cloud reviewer** attached to the PR (`prUrl`). Comment only; no second PR.
5. Move Linear to **In Review**. Bugbot comments on the GitHub PR on its own.

## Layout

- `payments/` — ACH API (`audit.ts` is the seeded gap)
- `orchestrator/` — Cursor SDK pipeline
- `.cursor/BUGBOT.md` — Bugbot rules
- `.cursor/hooks.json` — deny `git push/checkout/merge main` for cloud agents

## Live-extend

Ask the agent to update `payments/RUNBOOK.md` and open a child Linear ticket for the quarterly PCI attestation. Still no push to `main`.
