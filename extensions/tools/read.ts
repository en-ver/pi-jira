import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { GetConfig } from "../lib/config.js";
import { jiraFetch, throwIfError } from "../lib/http.js";
import { adfToMd } from "../lib/adf.js";
import { text, truncate, formatDate, displayName, renderComment } from "../lib/output.js";


export function registerReadTool(
  pi: ExtensionAPI,
  getConfig: GetConfig,
) {
  pi.registerTool({
    name: "jira_read",
    label: "Jira Read",
    description:
      "Read a Jira issue with full details including description and comments. " +
      "Description and comments are returned as markdown.",
    parameters: Type.Object({
      issueKey: Type.String({ description: "Issue key (e.g., PROJ-123)" }),
      includeComments: Type.Optional(
        Type.Boolean({ description: "Include comments (default true)" }),
      ),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const cfg = getConfig(ctx);
      const wantComments = params.includeComments !== false;

      const response = await jiraFetch(cfg, "GET", `issue/${params.issueKey}`, undefined, signal);

      await throwIfError(response, `Issue not found: ${params.issueKey}`);

      const issue = await response.json();
      const f = issue.fields ?? {};

      const lines: string[] = [
        `${issue.key}: ${f.summary ?? "(no summary)"}`,
        `Status: ${f.status?.name ?? "—"} | Type: ${f.issuetype?.name ?? "—"} | Priority: ${f.priority?.name ?? "—"}`,
        `Assignee: ${displayName(f.assignee)} | Reporter: ${displayName(f.reporter)}`,
        `Created: ${formatDate(f.created)} | Updated: ${formatDate(f.updated)}`,
      ];

      if (f.labels?.length) lines.push(`Labels: ${f.labels.join(", ")}`);
      if (f.components?.length)
        lines.push(`Components: ${f.components.map((c: any) => c.name).join(", ")}`);
      if (f.fixVersions?.length)
        lines.push(`Fix Versions: ${f.fixVersions.map((v: any) => v.name).join(", ")}`);
      lines.push(`URL: ${cfg.url}/browse/${issue.key}`);

      // Description
      lines.push("", "## Description", adfToMd(f.description));

      // Comments — use inline comments from the issue response
      if (wantComments) {
        const commentData = f.comment ?? {};
        const comments: any[] = commentData.comments ?? [];
        const total: number = commentData.total ?? comments.length;

        if (comments.length > 0) {
          const truncatedNote = total > comments.length
            ? ` (showing ${comments.length} of ${total} — use jira_comments to fetch all)`
            : "";
          lines.push("", `## Comments (${total})${truncatedNote}`);
          for (const comment of comments) {
            lines.push("", renderComment(comment));
          }
        } else {
          lines.push("", "## Comments", "No comments.");
        }
      }

      return text(truncate(lines.join("\n")));
    },
  });
}
