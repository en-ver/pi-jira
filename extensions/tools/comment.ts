import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { GetConfig } from "../lib/config.js";
import { jiraFetch, throwIfError } from "../lib/http.js";
import { mdToAdf } from "../lib/adf.js";
import { text } from "../lib/output.js";

export function registerCommentTool(
  pi: ExtensionAPI,
  getConfig: GetConfig,
) {
  pi.registerTool({
    name: "jira_comment",
    label: "Jira Comment",
    description:
      "Add a comment to a Jira issue. Provide the comment body in markdown — " +
      "it will be converted to Atlassian Document Format automatically.",
    parameters: Type.Object({
      issueKey: Type.String({ description: "Issue key (e.g., PROJ-123)" }),
      body: Type.String({ description: "Comment text in markdown" }),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const cfg = getConfig(ctx);

      const response = await jiraFetch(
        cfg,
        "POST",
        `issue/${params.issueKey}/comment`,
        { body: mdToAdf(params.body) },
        signal,
      );

      await throwIfError(response, `Issue not found: ${params.issueKey}`);

      return text(
        `Added comment to ${params.issueKey}\nURL: ${cfg.url}/browse/${params.issueKey}`,
      );
    },
  });
}
