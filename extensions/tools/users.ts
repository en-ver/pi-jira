import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { GetConfig } from "../lib/config.js";
import { jiraFetch, throwIfError } from "../lib/http.js";
import { text } from "../lib/output.js";

export function registerUsersTool(
  pi: ExtensionAPI,
  getConfig: GetConfig,
) {
  pi.registerTool({
    name: "jira_users",
    label: "Jira Users",
    description:
      "Search for Jira users by name or email. Returns display name and account ID " +
      "which can be used in fields like assignee, reporter, etc. " +
      "Use this to look up account IDs before assigning users to issues.",
    parameters: Type.Object({
      query: Type.String({
        description: "Search string to match against user name or email",
      }),
      maxResults: Type.Optional(
        Type.Number({
          description: "Max users to return (default 10, max 50)",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const cfg = getConfig(ctx);
      const limit = Math.min(params.maxResults ?? 10, 50);

      const qp = new URLSearchParams({
        query: params.query,
        maxResults: String(limit),
      });

      const response = await jiraFetch(
        cfg,
        "GET",
        `user/search?${qp}`,
        undefined,
        signal,
      );

      await throwIfError(response);

      const users: any[] = await response.json();

      if (users.length === 0) {
        return text(`No users found matching: ${params.query}`);
      }

      const lines = [`Found ${users.length} user(s):\n`];
      for (const user of users) {
        const status = user.active === false ? " (inactive)" : "";
        lines.push(
          `- ${user.displayName ?? "Unknown"}${status} — accountId: ${user.accountId}`,
        );
      }

      return text(lines.join("\n"));
    },
  });
}
