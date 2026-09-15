import { Agent, CursorAgentError, type AgentOptions, type RunResult } from "@cursor/sdk";
import { config, linearMcpServers, required } from "./config.ts";
import type { LinearIssue } from "./linear.ts";

export type GitOutcome = {
  branch?: string;
  prUrl?: string;
  repoUrl?: string;
};

function gitOutcome(result: RunResult): GitOutcome {
  const branch = result.git?.branches?.[0];
  const text = result.result ?? "";
  const prFromText = text.match(/https:\/\/github\.com\/[^\s)]+\/pull\/\d+/)?.[0];
  return {
    branch: branch?.branch,
    prUrl: branch?.prUrl ?? prFromText,
    repoUrl: branch?.repoUrl,
  };
}

function isMain(branch: string | undefined): boolean {
  return (branch ?? "").replace(/^refs\/heads\//, "") === "main";
}

async function runAgent(
  label: string,
  prompt: string,
  options: Omit<AgentOptions, "apiKey" | "model">,
) {
  const apiKey = required("CURSOR_API_KEY");
  await using agent = await Agent.create({
    ...options,
    apiKey,
    model: { id: config.modelId },
  });
  console.log(`[${label}] agent ${agent.agentId}`);
  const run = await agent.send(prompt);
  console.log(`[${label}] run ${run.id}`);
  try {
    for await (const event of run.stream()) {
      if (event.type === "assistant") {
        for (const block of event.message.content) {
          if (block.type === "text") process.stdout.write(block.text);
        }
      } else if (event.type === "tool_call") {
        console.log(`\n[${label}] tool ${event.name} ${event.status}`);
      }
    }
  } catch {
    // Stream is optional. wait() is the terminal signal.
  }
  const result = await run.wait();
  if (result.status === "error") {
    throw new Error(`${label} run failed: ${result.error?.message ?? result.id}`);
  }
  if (result.status === "cancelled") {
    throw new Error(`${label} run cancelled: ${result.id}`);
  }
  return { agentId: agent.agentId, result, git: gitOutcome(result) };
}

export async function remediate(issue: LinearIssue) {
  const mcpServers = linearMcpServers();
  try {
    const out = await runAgent(
      "remediator",
      remediatorPrompt(issue),
      {
        name: `harbor-remediator-${issue.identifier}`,
        cloud: {
          repos: [{ url: config.repoUrl, startingRef: config.startingRef }],
          workOnCurrentBranch: false,
          autoCreatePR: true,
          openAsCursorGithubApp: true,
          skipReviewerRequest: true,
          metadata: {
            linear_issue: issue.identifier,
            role: "remediator",
          },
        },
        ...(mcpServers ? { mcpServers } : {}),
      },
    );
    if (isMain(out.git.branch)) {
      throw new Error(
        `Policy violation: remediator reported branch "${out.git.branch}". Harbor never pushes to main.`,
      );
    }
    if (!out.git.prUrl) {
      throw new Error("Remediator finished without a pull request URL.");
    }
    return out;
  } catch (err) {
    if (err instanceof CursorAgentError) {
      throw new Error(`Remediator failed to start: ${err.message} retryable=${err.isRetryable}`);
    }
    throw err;
  }
}

export async function reviewPr(issue: LinearIssue, prUrl: string) {
  const mcpServers = linearMcpServers();
  try {
    return await runAgent(
      "reviewer",
      reviewerPrompt(issue, prUrl),
      {
        name: `harbor-reviewer-${issue.identifier}`,
        cloud: {
          repos: [{ url: config.repoUrl, prUrl }],
          workOnCurrentBranch: true,
          autoCreatePR: false,
          metadata: {
            linear_issue: issue.identifier,
            role: "reviewer",
            pr_url: prUrl,
          },
        },
        ...(mcpServers ? { mcpServers } : {}),
      },
    );
  } catch (err) {
    if (err instanceof CursorAgentError) {
      throw new Error(`Reviewer failed to start: ${err.message} retryable=${err.isRetryable}`);
    }
    throw err;
  }
}

function remediatorPrompt(issue: LinearIssue): string {
  return `You are Harbor's control-gap remediator for ${issue.identifier}: ${issue.title}.

Linear: ${issue.url}
Repo: ${config.repoUrl}

Issue body:
${issue.description ?? "(no description)"}

Hard policy:
- NEVER checkout, commit to, merge, or git push main.
- Create a NEW branch (suggested: fix/${issue.identifier.toLowerCase()}).
- Open a pull request into main. Do not merge it.
- Do not mark the Linear issue Done. In Review only.

Work:
1. Fix ONLY the control gap described in this Linear issue. Do not "clean up" unrelated seeded gaps.
2. Make the matching test in payments/test/control-gap.test.ts pass. Run npm test -w payments.
3. Unrelated failing control-gap tests may still fail — that is expected. Do not close every gap in one PR.
4. Update payments/RUNBOOK.md for this control only.
5. PR title and body must cite ${issue.identifier}.
6. If Linear MCP is available, comment the PR URL on the issue. Still do not set Done.

Return the branch name and PR URL at the end.`;
}

function reviewerPrompt(issue: LinearIssue, prUrl: string): string {
  return `You are Harbor's change-advisory (CAB) reviewer — a different bot from Bugbot.

Linear: ${issue.identifier} ${issue.url}
PR: ${prUrl}

Hard policy:
- NEVER push, merge, or commit to main.
- You are attached to the existing PR branch. Prefer comment-only.
- If you must commit a blocking control fix, commit only on this PR branch.
- Do not approve merge. Do not close Linear as Done.

Review for:
1. The PR actually closes the control named in ${issue.identifier} (${issue.title}).
2. The matching control-gap test now passes. Unrelated seeded gaps may still fail — that is OK.
3. No secrets were added. PR cites ${issue.identifier}. RUNBOOK.md matches this change.
4. Diff does not target main directly.

Post a PR review comment titled "Harbor CAB review" with PASS or BLOCK, then a short Linear comment summarizing the same. Mention that Bugbot is the automated bug/security reviewer on this PR and you are the SDLC/control reviewer.

Do not duplicate Bugbot's line-by-line bug hunt unless you find a control miss Bugbot would not cover.`;
}
