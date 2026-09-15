import type { McpServerConfig } from "@cursor/sdk";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function loadEnv(): void {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const path = resolve(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required. Copy .env.example to .env.`);
  return value;
}

export const config = {
  repoUrl: process.env.HARBOR_REPO_URL ?? "https://github.com/subtub98/harbor-solutions",
  startingRef: process.env.HARBOR_REPO_REF ?? "main",
  linearTeam: process.env.LINEAR_TEAM ?? "Subbu Iyer",
  linearProject: process.env.LINEAR_PROJECT ?? "harbor",
  linearTeamId: process.env.LINEAR_TEAM_ID ?? "726791ed-5225-4d97-8207-c1b573e6ba7b",
  linearProjectId: process.env.LINEAR_PROJECT_ID ?? "9ec3f8a1-3d8d-403b-87a6-6c298e9de417",
  modelId: process.env.CURSOR_MODEL ?? "composer-2.5",
};

export function linearMcpServers(): Record<string, McpServerConfig> | undefined {
  const key = process.env.LINEAR_API_KEY?.trim();
  if (!key) return undefined;
  return {
    linear: {
      type: "http",
      url: "https://mcp.linear.app/sse",
      headers: { Authorization: `Bearer ${key}` },
    },
  };
}
