import { truncateHead } from "@mariozechner/pi-coding-agent";
import { adfToMd } from "./adf.js";

export function text(s: string) {
  return { content: [{ type: "text" as const, text: s }], details: undefined };
}

export function truncate(s: string): string {
  const result = truncateHead(s);
  if (result.truncated) {
    return result.content + "\n\n(output truncated)";
  }
  return result.content;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toISOString().split("T")[0];
  } catch {
    return dateStr;
  }
}

export function displayName(user: any): string {
  if (!user) return "Unassigned";
  return user.displayName || user.name || user.emailAddress || "Unknown";
}

export function renderComment(comment: any): string {
  const author = displayName(comment.author);
  const date = formatDate(comment.created);
  return `### ${author} — ${date}\n${adfToMd(comment.body)}`;
}
