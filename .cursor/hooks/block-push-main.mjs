import { stdin } from "node:process";

const BLOCK =
  /\bgit\s+(push|publish)\b[\s\S]*\bmain\b|\bgit\s+checkout\s+(-B\s+)?main\b|\bgit\s+merge\b[\s\S]*\bmain\b|\bgit\s+switch\s+main\b/i;

async function readStdin(): Promise<string> {
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const raw = await readStdin();
let command = "";
try {
  command = String(JSON.parse(raw).command ?? "");
} catch {
  command = raw;
}

if (BLOCK.test(command)) {
  process.stdout.write(
    JSON.stringify({
      permission: "deny",
      user_message: "Harbor policy: never push, checkout, or merge main from an agent.",
      agent_message:
        "Blocked. Create a new branch and open a pull request into main. Do not push to main.",
    }),
  );
  process.exit(0);
}

process.stdout.write(JSON.stringify({ permission: "allow" }));
