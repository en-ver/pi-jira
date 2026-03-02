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

/**
 * Normalize literal "\n" (two characters: backslash + n) into real newline characters.
 *
 * Why this is needed:
 * LLM tool-call parameters may arrive with literal "\n" sequences instead of actual
 * newlines depending on how the framework passes string values (e.g. XML-based tool
 * calls don't JSON-decode escape sequences). The markdown parser (marklassian / marked)
 * requires real newlines to recognize block-level structures like headings, lists,
 * code fences, and paragraph breaks. Without this normalization the entire input is
 * treated as a single unformatted paragraph.
 */
function normalizeLiteralNewlines(text: string): string {
  return text.replace(/\\n/g, "\n");
}

export function mdToAdf(markdown: string): object {
  return markdownToAdf(normalizeLiteralNewlines(markdown));
}
