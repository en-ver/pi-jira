import { convertADFToMarkdown, type ADFDocument } from "adf-to-markdown";
import { markdownToAdf } from "marklassian";

/** Atlassian Document Format document — matches the shape returned by marklassian and accepted by the Jira API. */
export interface AdfDocument {
  version: 1;
  type: "doc";
  content: AdfNode[];
}

/** A mark (inline formatting) applied to an ADF text node. */
export interface AdfMark {
  type: string;
  attrs?: Record<string, unknown>;
}

/** A single node within an ADF document. */
export interface AdfNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: AdfNode[];
  marks?: AdfMark[];
  text?: string;
}

/**
 * Convert Atlassian Document Format (ADF) to Markdown.
 *
 * @param adf - ADF object from Jira API (typed as unknown since it comes from raw API responses)
 * @returns Markdown string, or a fallback message if the input is empty or unparseable
 * @throws Never — errors are caught and returned as fallback strings
 */
export function adfToMd(adf: unknown): string {
  if (!adf || typeof adf !== "object") return "(empty)";
  if (!("type" in adf) || !("version" in adf) || !("content" in adf)) return "(empty)";
  try {
    return convertADFToMarkdown(adf as ADFDocument);
  } catch (error) {
    console.error("Failed to convert ADF to Markdown:", error);
    return "(unable to parse description)";
  }
}

/**
 * Normalize literal escape sequences into their actual characters.
 *
 * Why this is needed:
 * LLM tool-call parameters may arrive with literal escape sequences instead of actual
 * characters depending on how the framework passes string values (e.g. XML-based tool
 * calls don't JSON-decode escape sequences). The markdown parser (marklassian / marked)
 * requires real newlines to recognize block-level structures like headings, lists,
 * code fences, and paragraph breaks. Without this normalization the entire input is
 * treated as a single unformatted paragraph.
 *
 * Double-escaped sequences (e.g. \\n in code string literals like `"hello\\nworld"`)
 * are preserved as single-escaped sequences (\n) so they display literally inside
 * code blocks rather than being converted to real newlines.
 *
 * Strategy — single-pass regex with callback:
 *   Double-escaped sequences (length 3) are matched first and preserved as
 *   single-escaped literals. CRLF (length 4) is matched before individual CR/LF
 *   to avoid double-conversion. Everything else maps to its real character.
 *
 * Handles:
 * - `\\n` → `\n`  (preserved literal, e.g. in code strings)
 * - `\r\n` (Windows CRLF) → newline
 * - `\r`   (old Mac CR)   → newline
 * - `\n`   (Unix LF)      → newline
 * - `\t`   (tab)          → tab character
 */
function normalizeLiteralEscapes(text: string): string {
  return text.replace(/\\\\[nrt]|\\r\\n|\\r|\\n|\\t/g, (match) => {
    if (match.length === 3) return match.slice(1); // \\n/\\r/\\t → \n/\r/\t (literal)
    if (match === "\\t") return "\t";
    return "\n"; // \r\n (4 chars), \r, \n → real newline
  });
}

/**
 * Convert Markdown to Atlassian Document Format (ADF).
 *
 * Literal escape sequences (e.g. `\n`, `\r\n`, `\t`) in the input are normalized
 * to their actual characters before conversion, to handle LLM tool-call parameter
 * encoding quirks.
 *
 * @param markdown - Markdown string to convert
 * @returns ADF document object ready to send to the Jira API
 * @throws TypeError if markdown is not a string
 * @throws Error if the conversion fails
 */
export function mdToAdf(markdown: string): AdfDocument {
  if (typeof markdown !== "string") {
    throw new TypeError(`mdToAdf: expected a string, got ${typeof markdown}`);
  }
  try {
    return markdownToAdf(normalizeLiteralEscapes(markdown));
  } catch (error) {
    throw new Error(`Failed to convert Markdown to ADF: ${error}`);
  }
}
