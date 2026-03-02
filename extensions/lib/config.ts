import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JiraConfig {
  url: string;
  email: string;
  apiToken: string;
}

export type GetConfig = (ctx: ExtensionContext) => JiraConfig;

// ---------------------------------------------------------------------------
// Config loader
// ---------------------------------------------------------------------------

function resolveValue(value: string): string {
  if (value.startsWith("$")) {
    const envKey = value.slice(1);
    const envVal = process.env[envKey];
    if (!envVal) {
      throw new Error(
        `Environment variable ${envKey} is not set (referenced as "${value}" in jira.json)`,
      );
    }
    return envVal;
  }
  return value;
}

export function loadConfig(cwd: string): JiraConfig {
  const candidates = [
    path.join(cwd, ".pi", "jira.json"),
    path.join(os.homedir(), ".pi", "agent", "jira.json"),
  ];

  let raw: string | null = null;
  let configPath: string | null = null;

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      raw = fs.readFileSync(candidate, "utf-8");
      configPath = candidate;
      break;
    }
  }

  if (!raw || !configPath) {
    throw new Error(
      "Jira config not found. Create one of:\n" +
        "  • .pi/jira.json (project-local)\n" +
        "  • ~/.pi/agent/jira.json (global)\n\n" +
        "Example:\n" +
        JSON.stringify(
          { url: "$JIRA_URL", email: "$JIRA_EMAIL", apiToken: "$JIRA_API_TOKEN" },
          null,
          2,
        ),
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${configPath}`);
  }

  const url = resolveValue(String(parsed.url ?? ""));
  const email = resolveValue(String(parsed.email ?? ""));
  const apiToken = resolveValue(String(parsed.apiToken ?? ""));

  if (!url) throw new Error(`"url" is missing or empty in ${configPath}`);
  if (!email) throw new Error(`"email" is missing or empty in ${configPath}`);
  if (!apiToken) throw new Error(`"apiToken" is missing or empty in ${configPath}`);

  return { url: url.replace(/\/+$/, ""), email, apiToken };
}
