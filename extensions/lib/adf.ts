import { convertADFToMarkdown } from "adf-to-markdown";
import { markdownToAdf } from "marklassian";

export function adfToMd(adf: unknown): string {
  if (!adf || typeof adf !== "object") return "(empty)";
  try {
    return convertADFToMarkdown(adf as any);
  } catch {
    return "(unable to parse description)";
  }
}

export function mdToAdf(markdown: string): object {
  return markdownToAdf(markdown);
}
