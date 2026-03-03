import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { GetConfig } from "../lib/config.js";
import { jiraFetch, throwIfError } from "../lib/http.js";
import { text, truncate, rawJson, renderComment } from "../lib/output.js";

const DEFAULT_FIELDS = ["author", "created", "body"] as const;

export function registerCommentsTool(
  pi: ExtensionAPI,
  getConfig: GetConfig,
) {
  pi.registerTool({
    name: "jira_comments",
    label: "Jira Comments",
    description:
      "List comments on a Jira issue with pagination support. " +
      "Use this when you need all comments or a specific page — " +
      "for most cases the comments included in jira_read (first 50) are sufficient.",
    promptSnippet: "List all comments on a Jira issue with pagination",
    promptGuidelines: [
      "For most cases, the comments included in jira_read (first 50) are sufficient.",
      "Use this tool when you need all comments, a specific page, or reverse chronological order.",
    ],
    parameters: Type.Object({
      issueKey: Type.String({ description: "Issue key (e.g., PROJ-123)" }),
      startAt: Type.Optional(
        Type.Number({ description: "Index of first comment to return (default 0)" }),
      ),
      maxResults: Type.Optional(
        Type.Number({ description: "Max comments to return (default 50, max 100)" }),
      ),
      orderBy: Type.Optional(
        Type.String({
          description:
            'Order by field (default "created" for oldest first, use "-created" for newest first)',
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

      const limit = Math.min(params.maxResults ?? 50, 100);
      const qp = new URLSearchParams({
        maxResults: String(limit),
        orderBy: params.orderBy ?? "created",
      });
      if (params.startAt != null) {
        qp.set("startAt", String(params.startAt));
      }

      const response = await jiraFetch(
        cfg,
        "GET",
        `issue/${params.issueKey}/comment?${qp}`,
        undefined,
        signal,
      );

      await throwIfError(response, `Issue not found: ${params.issueKey}`);

      const data: any = await response.json();

      if (params.raw) return rawJson(data);

      const comments: any[] = data.comments ?? [];
      const total: number = data.total ?? comments.length;
      const startAt: number = data.startAt ?? 0;

      if (comments.length === 0) {
        return text(
          startAt > 0
            ? `No comments at offset ${startAt} (total: ${total})`
            : `No comments on ${params.issueKey}`,
        );
      }

      const lines: string[] = [];

      if (total > comments.length || startAt > 0) {
        lines.push(
          `Comments on ${params.issueKey}: showing ${startAt + 1}–${startAt + comments.length} of ${total}\n`,
        );
      } else {
        lines.push(`Comments on ${params.issueKey}: ${total} total\n`);
      }

      for (const comment of comments) {
        lines.push(renderComment(comment), "");
      }

      if (startAt + comments.length < total) {
        lines.push(
          `--- More comments available. Use startAt=${startAt + comments.length} to fetch the next page. ---`,
        );
      }

      return text(truncate(lines.join("\n")));
    },
  });
}
