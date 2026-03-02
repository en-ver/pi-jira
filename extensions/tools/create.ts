import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { GetConfig } from "../lib/config.js";
import { jiraFetch, throwIfError } from "../lib/http.js";
import { mdToAdf } from "../lib/adf.js";
import { text, rawJson } from "../lib/output.js";

export function registerCreateTool(
  pi: ExtensionAPI,
  getConfig: GetConfig,
) {
  pi.registerTool({
    name: "jira_create",
    label: "Jira Create",
    description:
      "Create a new Jira issue. Provide the description in markdown — it will be " +
      "converted to Atlassian Document Format automatically.",
    parameters: Type.Object({
      projectKey: Type.String({ description: "Project key (e.g., PROJ)" }),
      issueType: Type.String({
        description: "Issue type name (e.g., Bug, Task, Story, Epic)",
      }),
      summary: Type.String({ description: "Issue title / summary" }),
      description: Type.Optional(
        Type.String({ description: "Issue description in markdown" }),
      ),
      fields: Type.Optional(
        Type.Record(Type.String(), Type.Unknown(), {
          description:
            'Additional fields as key-value pairs (e.g., {"priority": {"name": "High"}, "labels": ["backend"]})',
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

      const issueFields: Record<string, unknown> = {
        ...params.fields,
        project: { key: params.projectKey },
        issuetype: { name: params.issueType },
        summary: params.summary,
      };

      if (params.description) {
        issueFields.description = mdToAdf(params.description);
      }

      const response = await jiraFetch(cfg, "POST", "issue", { fields: issueFields }, signal);

      await throwIfError(response);

      const data: any = await response.json();

      if (params.raw) return rawJson(data);

      return text(`Created ${data.key}: ${params.summary}\nURL: ${cfg.url}/browse/${data.key}`);
    },
  });
}
