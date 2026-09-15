import { loadEnv, config } from "./config.ts";
import { commentOnIssue, createControlGapIssue, getIssue, setIssueState } from "./linear.ts";
import { remediate, reviewPr } from "./agents.ts";

loadEnv();

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const demo = process.argv.includes("--demo");
  const issueFlag = arg("--issue");

  if (!demo && !issueFlag) {
    console.error("Usage: tsx src/run.ts --demo | --issue SUB-12");
    process.exit(1);
  }

  console.log(`Harbor SDLC · repo ${config.repoUrl} · Linear project ${config.linearProject}`);

  const issue = demo ? await createControlGapIssue() : await getIssue(issueFlag!);
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
      `- Control: PCI-DSS 10.2 (ACH audit amount)`,
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

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
