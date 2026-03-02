import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { GetConfig } from "../lib/config.js";
import { jiraFetch, throwIfError } from "../lib/http.js";
import { adfToMd } from "../lib/adf.js";
import { text, truncate, rawJson, formatDate, displayName, renderComment } from "../lib/output.js";

const DEFAULT_FIELDS = [
  "summary",
  "status",
  "issuetype",
  "priority",
  "assignee",
  "reporter",
  "created",
  "updated",
  "labels",
  "components",
  "fixVersions",
  "description",
  "comment",
];

export function registerReadTool(
  pi: ExtensionAPI,
  getConfig: GetConfig,
) {
  pi.registerTool({
    name: "jira_read",
    label: "Jira Read",
    description:
      "Read a Jira issue with full details including description and comments. " +
      "Description and comments are returned as markdown. " +
      "Only default fields are returned unless you specify custom ones via the fields parameter. " +
      "To include custom fields, use jira_fields first to discover their IDs (e.g., customfield_12345).",
    parameters: Type.Object({
      issueKey: Type.String({ description: "Issue key (e.g., PROJ-123)" }),
      includeComments: Type.Optional(
        Type.Boolean({ description: "Include comments (default true)" }),
      ),
      fields: Type.Optional(
        Type.Array(Type.String(), {
          description:
            "Fields to include (default: summary, status, issuetype, priority, assignee, " +
            "reporter, created, updated, labels, components, fixVersions, description, comment). " +
            "Use this to add custom fields (e.g., customfield_12345) or narrow the response.",
        }),
      ),
      raw: Type.Optional(
        Type.Boolean({
          description:
            "Return the raw API response instead of the filtered summary (default false). " +
            "Warning: raw output can be very large and may consume significant context window.",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const cfg = getConfig(ctx);
      const wantComments = params.includeComments !== false;
      const requestedFields = params.fields ?? DEFAULT_FIELDS;

      const qp = new URLSearchParams({ fields: requestedFields.join(",") });
      const response = await jiraFetch(cfg, "GET", `issue/${params.issueKey}?${qp}`, undefined, signal);

      await throwIfError(response, `Issue not found: ${params.issueKey}`);

      const issue: any = await response.json();

      if (params.raw) return rawJson(issue);
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
