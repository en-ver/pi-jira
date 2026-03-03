import { Type } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { GetConfig, JiraConfig } from "../lib/config.js";
import { jiraFetch, throwIfError } from "../lib/http.js";
import { text, truncate, rawJson } from "../lib/output.js";

const DEFAULT_ISSUE_TYPE_FIELDS = ["name", "id", "subtask"] as const;
const DEFAULT_FIELD_META_FIELDS = ["fieldId", "name", "schema", "required", "allowedValues", "defaultValue"] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchIssueTypes(
  cfg: JiraConfig,
  projectKey: string,
  signal: AbortSignal | undefined,
): Promise<any[]> {
  const response = await jiraFetch(
    cfg,
    "GET",
    `issue/createmeta/${projectKey}/issuetypes`,
    undefined,
    signal,
  );

  await throwIfError(response, `Project not found: ${projectKey}`);

  const data: any = await response.json();
  return data.values ?? data.issueTypes ?? data ?? [];
}

function resolveIssueType(
  issueTypes: any[],
  issueTypeName: string,
  projectKey: string,
): any {
  const matched = issueTypes.find(
    (it: any) => it.name.toLowerCase() === issueTypeName.toLowerCase(),
  );
  if (!matched) {
    const available = issueTypes.map((it: any) => it.name).join(", ");
    throw new Error(
      `Issue type "${issueTypeName}" not found in project ${projectKey}. Available: ${available}`,
    );
  }
  return matched;
}

async function fetchFields(
  cfg: JiraConfig,
  projectKey: string,
  issueTypeId: string,
  signal: AbortSignal | undefined,
): Promise<any[]> {
  const response = await jiraFetch(
    cfg,
    "GET",
    `issue/createmeta/${projectKey}/issuetypes/${issueTypeId}`,
    undefined,
    signal,
  );

  await throwIfError(response);

  const data: any = await response.json();
  return data.values ?? data.fields ?? [];
}

function formatIssueTypeList(projectKey: string, issueTypes: any[]): string {
  if (issueTypes.length === 0) {
    return `No issue types found for project ${projectKey}`;
  }
  const lines: string[] = [`Issue types for ${projectKey}:\n`];
  for (const it of issueTypes) {
    const subtask = it.subtask ? " (subtask)" : "";
    lines.push(`  • ${it.name} (id: ${it.id})${subtask}`);
  }
  return lines.join("\n");
}

function formatField(f: any): string[] {
  const lines: string[] = [];
  const schemaType = f.schema?.type ?? "unknown";
  const customType = f.schema?.custom
    ? ` (${f.schema.custom.split(":").pop()})`
    : "";
  lines.push(
    `  ${f.fieldId ?? f.key ?? f.id} "${f.name}" — ${schemaType}${customType}`,
  );

  if (f.allowedValues && f.allowedValues.length > 0) {
    const values = f.allowedValues.map((v: any) => {
      if (v.name) return v.name;
      if (v.value) return v.value;
      if (typeof v === "string") return v;
      return JSON.stringify(v);
    });
    const display = values.slice(0, 30);
    const suffix = values.length > 30 ? `, ... (${values.length} total)` : "";
    lines.push(`    Allowed values: ${display.join(", ")}${suffix}`);
  }

  if (f.defaultValue !== undefined && f.defaultValue !== null) {
    const dv =
      f.defaultValue.name ??
      f.defaultValue.value ??
      JSON.stringify(f.defaultValue);
    lines.push(`    Default: ${dv}`);
  }

  return lines;
}

function formatFieldMetadata(
  projectKey: string,
  typeName: string,
  fields: any[],
): string {
  if (fields.length === 0) {
    return `No fields found for ${projectKey} / ${typeName}`;
  }

  const required: any[] = [];
  const optional: any[] = [];
  for (const f of fields) {
    if (f.required) {
      required.push(f);
    } else {
      optional.push(f);
    }
  }

  const lines: string[] = [`Fields for ${projectKey} / ${typeName}:\n`];

  if (required.length > 0) {
    lines.push("Required:");
    for (const f of required) {
      lines.push(...formatField(f));
    }
  }

  if (optional.length > 0) {
    lines.push("", "Optional:");
    for (const f of optional) {
      lines.push(...formatField(f));
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerFieldsTool(
  pi: ExtensionAPI,
  getConfig: GetConfig,
) {
  pi.registerTool({
    name: "jira_fields",
    label: "Jira Fields",
    description:
      "Get field metadata for creating/editing issues in a project. " +
      "Without issueType, lists available issue types. " +
      "With issueType, returns all fields with names, IDs, required flag, types, " +
      "and allowed values for dropdown/select fields.",
    promptSnippet: "Discover issue types and required fields for a project",
    promptGuidelines: [
      "Call without issueType to list available issue types for a project.",
      "Call with issueType to get all fields, their types, and which are required.",
      "Required fields must be provided when creating an issue via jira_create.",
    ],
    parameters: Type.Object({
      projectKey: Type.String({ description: "Project key (e.g., PROJ)" }),
      issueType: Type.Optional(
        Type.String({
          description:
            "Issue type name (e.g., Bug, Task, Story). Omit to list available issue types.",
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

      const issueTypes = await fetchIssueTypes(cfg, params.projectKey, signal);

      if (!params.issueType) {
        if (params.raw) return rawJson(issueTypes);
        return text(formatIssueTypeList(params.projectKey, issueTypes));
      }

      const matchedType = resolveIssueType(issueTypes, params.issueType, params.projectKey);
      const fields = await fetchFields(cfg, params.projectKey, matchedType.id, signal);

      if (params.raw) return rawJson(fields);
      return text(truncate(formatFieldMetadata(params.projectKey, matchedType.name, fields)));
    },
  });
}
