import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { GetConfig } from "../lib/config.js";
import { jiraFetch, throwIfError } from "../lib/http.js";
import { text } from "../lib/output.js";

export function registerProjectsTool(
  pi: ExtensionAPI,
  getConfig: GetConfig,
) {
  pi.registerTool({
    name: "jira_projects",
    label: "Jira Projects",
    description:
      "List Jira projects. Optionally filter by name or key with a search query. " +
      "Returns project key and name only.",
    parameters: Type.Object({
      query: Type.Optional(
        Type.String({
          description:
            "Filter by project name or key (case insensitive). Omit to list all projects.",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const cfg = getConfig(ctx);

      const qp = new URLSearchParams();
      qp.set("maxResults", "100");
      qp.set("orderBy", "name");
      if (params.query) qp.set("query", params.query);

      const response = await jiraFetch(
        cfg,
        "GET",
        `project/search?${qp}`,
        undefined,
        signal,
      );

      await throwIfError(response);

      const data = await response.json();
      const projects: any[] = data.values ?? [];

      if (projects.length === 0) {
        return text(
          params.query
            ? `No projects found matching "${params.query}"`
            : "No projects found",
        );
      }

      const lines: string[] = [
        `Projects${params.query ? ` matching "${params.query}"` : ""}:\n`,
      ];
      for (const p of projects) {
        lines.push(`  ${p.key} — ${p.name}`);
      }
      if (!data.isLast) {
        const moreMsg = data.total != null
          ? `\n  ... and ${data.total - projects.length} more (refine your search)`
          : "\n  ... more results available (refine your search)";
        lines.push(moreMsg);
      }
      return text(lines.join("\n"));
    },
  });
}
