import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { GetConfig } from "../lib/config.js";
import { jiraFetch, throwIfError } from "../lib/http.js";
import { text, truncate, formatDate, displayName } from "../lib/output.js";

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
    }),

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const cfg = getConfig(ctx);

      const requestedFields = params.fields ?? [
        "summary",
        "status",
        "assignee",
        "priority",
        "issuetype",
        "created",
        "updated",
      ];
      const limit = Math.min(params.maxResults ?? 20, 50);

      const queryParams = new URLSearchParams({
        jql: params.jql,
        maxResults: String(limit),
        fields: requestedFields.join(","),
      });

      const response = await jiraFetch(cfg, "GET", `search/jql?${queryParams}`, undefined, signal);

      await throwIfError(response);

      const data = await response.json();
      const issues: any[] = data.issues ?? [];

      if (issues.length === 0) {
        return text(`No issues found for JQL: ${params.jql}`);
      }

      const hasMore = data.nextPageToken && !data.isLast;
      const lines: string[] = [
        `Found ${issues.length} issue(s)${hasMore ? " (more available)" : ""}:\n`,
      ];

      for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        const f = issue.fields ?? {};
        const parts: string[] = [
          `${i + 1}. ${issue.key} [${f.status?.name ?? "—"}] — ${f.summary ?? "(no summary)"}`,
        ];

        const meta: string[] = [];
        if (f.issuetype?.name) meta.push(`Type: ${f.issuetype.name}`);
        if (f.priority?.name) meta.push(`Priority: ${f.priority.name}`);
        meta.push(`Assignee: ${displayName(f.assignee)}`);
        if (meta.length) parts.push(`   ${meta.join(" | ")}`);

        const dates: string[] = [];
        if (f.created) dates.push(`Created: ${formatDate(f.created)}`);
        if (f.updated) dates.push(`Updated: ${formatDate(f.updated)}`);
        if (dates.length) parts.push(`   ${dates.join(" | ")}`);

        lines.push(parts.join("\n"));
      }

      return text(truncate(lines.join("\n")));
    },
  });
}
