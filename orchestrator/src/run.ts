import { loadEnv, config } from "./config.ts";
import { commentOnIssue, createGapIssue, getIssue, setIssueState } from "./linear.ts";
import { remediate, reviewPr } from "./agents.ts";
import { GAPS, parseGapId } from "./tickets.ts";

loadEnv();

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

function usage(): never {
  console.error(`Usage:
  tsx src/run.ts --create max-amount|rejected-audit|idempotency|audit-read
  tsx src/run.ts --issue SUB-12`);
  process.exit(1);
}

function printCreatedTicket(identifier: string, url: string, gapCommand: string) {
  console.log(`Harbor SDLC · repo ${config.repoUrl} · Linear project ${config.linearProject}`);
  console.log(`Created ${identifier}: ${url}`);
  console.log("");
  console.log("SDLC Plan — ticket is in Linear (Backlog). GRC work started outside the IDE.");
  console.log("");
  console.log("Next, SDLC Triage — paste this to Clearing in Grok Bot:");
  console.log("");
  console.log(`Triage Linear ${identifier} in project harbor against GitHub subtub98/harbor-solutions.
Comment on ${identifier} with blast radius, control, and recommended next step.
Do not change code, do not merge, do not set Done. Ask me before anyone remediates.`);
  console.log("");
  console.log("If Clearing asks In Review vs Done, pick In Review.");
  console.log("");
  console.log("Then, SDLC Build — after you approve out loud:");
  console.log(`  npm run ingest -- --issue ${identifier}`);
  console.log("");
  console.log(`This ticket came from ${gapCommand}.`);
}

async function pipeline(issueFlag: string) {
  console.log(`Harbor SDLC · repo ${config.repoUrl} · Linear project ${config.linearProject}`);

  const issue = await getIssue(issueFlag);
  console.log(`Issue ${issue.identifier}: ${issue.url}`);

  await setIssueState(issue.id, "In Progress");

  const remediator = await remediate(issue);
  const prUrl = remediator.git.prUrl!;
  const branch = remediator.git.branch ?? "(unknown branch)";

  await commentOnIssue(
    issue.id,
    [
      `## Remediation started`,
      `- Branch: \`${branch}\` (not main)`,
      `- PR: ${prUrl}`,
      `- Remediator agent: \`${remediator.agentId}\``,
      `- Bugbot will review this PR automatically (already enabled on the repo).`,
      `- Harbor CAB review bot is next. This issue stays **In Review**, not Done.`,
    ].join("\n"),
  );

  const reviewer = await reviewPr(issue, prUrl);

  await setIssueState(issue.id, "In Review");
  await commentOnIssue(
    issue.id,
    [
      `## Change control packet`,
      `- Control: ${issue.title}`,
      `- PR: ${prUrl}`,
      `- Feature branch: \`${branch}\``,
      `- Remediator: \`${remediator.agentId}\``,
      `- CAB reviewer: \`${reviewer.agentId}\``,
      `- Bugbot: GitHub PR review (repo automation)`,
      `- Merge: human only. Agents cannot push to main.`,
    ].join("\n"),
  );

  console.log("\nDone.");
  console.log(`  issue    ${issue.url}`);
  console.log(`  branch   ${branch}`);
  console.log(`  pr       ${prUrl}`);
  console.log(`  review   ${reviewer.agentId}`);
}

async function main() {
  if (process.argv.includes("--demo")) {
    console.error("npm run demo is retired. Use npm run demo:practice-1|practice-2|practice-3|interview");
    process.exit(1);
  }

  const createFlag = arg("--create");
  const issueFlag = arg("--issue");

  if (createFlag) {
    const gap = parseGapId(createFlag);
    const issue = await createGapIssue(gap);
    printCreatedTicket(issue.identifier, issue.url, GAPS[gap].command);
    return;
  }

  if (!issueFlag) usage();
  await pipeline(issueFlag);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
