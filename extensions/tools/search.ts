import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { GetConfig } from "../lib/config.js";
import { jiraFetch, throwIfError } from "../lib/http.js";
import { text, truncate, rawJson } from "../lib/output.js";

const DEFAULT_FIELDS = [
  "summary",
  "status",
  "assignee",
  "priority",
  "issuetype",
  "created",
  "updated",
];

export function registerSearchTool(
  pi: ExtensionAPI,
  getConfig: GetConfig,
) {
  pi.registerTool({
    name: "jira_search",
    label: "Jira Search",
    description:
      "Search Jira issues using JQL. Returns a formatted list of matching issues " +
      "with key, summary, status, type, priority, and assignee.",
    promptSnippet: "Search Jira issues using JQL with pagination",
    promptGuidelines: [
      "Common JQL: assignee = currentUser(), project = PROJ AND status = \"In Progress\", sprint in openSprints(), text ~ \"term\", created >= -7d.",
    ],
    parameters: Type.Object({
      jql: Type.String({
        description: "JQL query string (e.g., 'project = PROJ AND status = Open')",
      }),
      maxResults: Type.Optional(
        Type.Number({ description: "Max issues to return (default 20, max 50)" }),
      ),
      fields: Type.Optional(
        Type.Array(Type.String(), {
          description:
            "Fields to include (default: summary, status, assignee, priority, issuetype, created, updated)",
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

      const requestedFields = params.fields ?? DEFAULT_FIELDS;
      const limit = Math.min(params.maxResults ?? 20, 50);

      const queryParams = new URLSearchParams({
        jql: params.jql,
        maxResults: String(limit),
        fields: requestedFields.join(","),
      });

      const response = await jiraFetch(cfg, "GET", `search/jql?${queryParams}`, undefined, signal);

      await throwIfError(response);

      const data: any = await response.json();

      if (params.raw) return rawJson(data);

      const issues: any[] = data.issues ?? [];

      if (issues.length === 0) {
        return text(`No issues found for JQL: ${params.jql}`);
      }

      const hasMore = data.nextPageToken && !data.isLast;
      const lines: string[] = [
        `Found ${issues.length} issue(s)${hasMore ? " (more available)" : ""}:\n`,
      ];

      for (const issue of issues) {
        const f = issue.fields ?? {};
        lines.push(`${issue.id} ${issue.key} — ${f.summary ?? "(no summary)"}`);
      }

      return text(truncate(lines.join("\n")));
    },
  });
}
