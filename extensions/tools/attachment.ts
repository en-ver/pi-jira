import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { GetConfig } from "../lib/config.js";
import { jiraFetch, throwIfError } from "../lib/http.js";
import { text, formatSize } from "../lib/output.js";
import * as fs from "node:fs";
import * as path from "node:path";

const MAX_DOWNLOAD_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_INLINE_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

type AllowedImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const IMAGE_TYPES: AllowedImageType[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function sanitizeFilename(filename: string, fallbackId: string): string {
  // Strip null bytes and control characters
  const sanitized = filename.replace(/[\x00-\x1f\x7f]/g, "");
  // If empty or relative path components, use fallback
  if (!sanitized || sanitized === "." || sanitized === "..") {
    return `attachment-${fallbackId}`;
  }
  return sanitized;
}

export function registerAttachmentTool(
  pi: ExtensionAPI,
  getConfig: GetConfig,
) {
  pi.registerTool({
    name: "jira_attachment",
    label: "Jira Attachment",
    description:
      "Download a Jira attachment by its ID. " +
      "Use jira_read to get attachment IDs and metadata first. " +
      "The attachment is saved to the specified output path (or current directory). " +
      "For images (jpg, png, gif, webp), the content is also returned inline for viewing.",
    promptSnippet: "Download a Jira issue attachment by ID",
    promptGuidelines: [
      "Use jira_read first to get attachment IDs from the issue.",
    ],
    parameters: Type.Object({
      attachmentId: Type.String({ description: "Attachment ID (e.g., 63899)" }),
      outputPath: Type.Optional(
        Type.String({
          description:
            "Path to save the attachment. Can be a directory (filename from Jira is used) " +
            "or a full file path. Defaults to current directory.",
        }),
      ),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const cfg = getConfig(ctx);

      if (!params.attachmentId?.trim()) {
        throw new Error("attachmentId is required and cannot be empty");
      }

      // First get attachment metadata to know the filename and mime type
      const metaResponse = await jiraFetch(cfg, "GET", `attachment/${params.attachmentId}`, undefined, signal);
      await throwIfError(metaResponse, `Attachment not found: ${params.attachmentId}`);
      const meta: any = await metaResponse.json();

      if (!meta || typeof meta !== "object") {
        throw new Error(`Invalid attachment metadata for ID: ${params.attachmentId}`);
      }

      // Sanitize filename to prevent path traversal and control character injection
      const rawFilename = path.basename(String(meta.filename ?? `attachment-${params.attachmentId}`));
      const filename = sanitizeFilename(rawFilename, params.attachmentId);
      const mimeType: string = String(meta.mimeType ?? "application/octet-stream");
      const size: number = Number(meta.size) || 0;

      // Enforce size limit to avoid memory exhaustion
      if (size > MAX_DOWNLOAD_SIZE) {
        throw new Error(
          `Attachment too large: ${formatSize(size)}. Maximum allowed: ${formatSize(MAX_DOWNLOAD_SIZE)}`,
        );
      }

      // Determine output path
      let outputFile: string;
      if (params.outputPath) {
        const resolved = path.resolve(ctx.cwd, params.outputPath);
        let isDir = false;
        try {
          isDir = fs.statSync(resolved).isDirectory();
        } catch (err: any) {
          if (err.code !== "ENOENT") {
            throw new Error(`Cannot access output path: ${resolved} (${err.message})`);
          }
          // Path doesn't exist, use trailing separator heuristic
          isDir = params.outputPath.endsWith(path.sep) || params.outputPath.endsWith("/");
        }
        outputFile = isDir ? path.join(resolved, filename) : resolved;
      } else {
        outputFile = path.resolve(ctx.cwd, filename);
      }

      // Download the attachment content
      const contentResponse = await jiraFetch(cfg, "GET", `attachment/content/${params.attachmentId}`, undefined, signal, "*/*");
      await throwIfError(contentResponse, `Failed to download attachment: ${params.attachmentId}`);

      const buffer = Buffer.from(await contentResponse.arrayBuffer());

      // Ensure parent directory exists and write file
      fs.mkdirSync(path.dirname(outputFile), { recursive: true });
      await fs.promises.writeFile(outputFile, buffer);

      const summary = [
        `Downloaded: ${filename}`,
        `Type: ${mimeType}`,
        `Size: ${formatSize(size)}`,
        `Saved to: ${outputFile}`,
      ].join("\n");

      // For images, return inline so the model can view them (if size allows)
      if (IMAGE_TYPES.includes(mimeType as AllowedImageType) && size <= MAX_INLINE_IMAGE_SIZE) {
        const base64 = buffer.toString("base64");
        return {
          content: [
            { type: "text" as const, text: summary },
            {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: mimeType as AllowedImageType,
                data: base64,
              },
            },
          ],
          details: undefined,
        };
      }

      return text(summary);
    },
  });
}
