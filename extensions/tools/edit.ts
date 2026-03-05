import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { GetConfig } from "../lib/config.js";
import { jiraFetch, throwIfError } from "../lib/http.js";
import { mdToAdf } from "../lib/adf.js";
import { text } from "../lib/output.js";

export function registerEditTool(
  pi: ExtensionAPI,
  getConfig: GetConfig,
) {
  pi.registerTool({
    name: "jira_edit",
    label: "Jira Edit",
    description:
      "Update an existing Jira issue. Provide at least one of summary, description, or fields. " +
      "Description should be in markdown — it will be converted to ADF automatically.",
    promptSnippet: "Update an existing Jira issue's fields or description",
    promptGuidelines: [
      "Use jira_fields to discover field names and allowed values before updating.",
      "Use jira_users to look up account IDs for assignee updates.",
    ],
    parameters: Type.Object({
      issueKey: Type.String({ description: "Issue key (e.g., PROJ-123)" }),
      summary: Type.Optional(Type.String({ description: "New issue title / summary" })),
      description: Type.Optional(
        Type.String({ description: "New description in markdown" }),
      ),
      fields: Type.Optional(
        Type.Record(Type.String(), Type.Unknown(), {
          description:
            'Additional fields to update as key-value pairs (e.g., {"priority": {"name": "High"}})',
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

      if (!params.summary && !params.description && !params.fields) {
        throw new Error(
          "Nothing to update. Provide at least one of: summary, description, or fields.",
        );
      }

      const updateFields: Record<string, unknown> = { ...params.fields };
      if (params.summary) updateFields.summary = params.summary;
      if (params.description) updateFields.description = mdToAdf(params.description);

      const response = await jiraFetch(
        cfg,
        "PUT",
        `issue/${params.issueKey}`,
        { fields: updateFields },
        signal,
      );

      await throwIfError(response, `Issue not found: ${params.issueKey}`);

      if (params.raw) {
        const body = await response.text();
        return text(body || `HTTP ${response.status} ${response.statusText}`);
      }

      return text(
        `Updated ${params.issueKey}${params.summary ? ": " + params.summary : ""}\nURL: ${cfg.url}/browse/${params.issueKey}`,
      );
    },
  });
}
