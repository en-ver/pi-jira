import type { JiraConfig } from "./config.js";

export async function jiraFetch(
  config: JiraConfig,
  method: string,
  apiPath: string,
  body?: unknown,
  signal?: AbortSignal,
  accept?: string,
): Promise<Response> {
  const url = `${config.url}/rest/api/3/${apiPath}`;
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");

  const headers: Record<string, string> = {
    Authorization: `Basic ${auth}`,
    Accept: accept ?? "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  try {
    return await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err: any) {
    // Let abort errors propagate so pi handles cancellation correctly
    if (err.name === "AbortError" || signal?.aborted) throw err;
    throw new Error(`Connection error: ${err.message}`);
  }
}

export async function throwIfError(response: Response, notFoundMsg?: string): Promise<void> {
  if (response.ok) return;
  if (response.status === 404 && notFoundMsg) throw new Error(notFoundMsg);
  throw new Error(await formatError(response));
}

export async function formatError(response: Response): Promise<string> {
  let detail = "";
  try {
    const json: any = await response.json();
    const messages: string[] = [];
    if (json.errorMessages?.length) messages.push(...json.errorMessages);
    if (json.errors) {
      for (const [field, msg] of Object.entries(json.errors)) {
        messages.push(`${field}: ${msg}`);
      }
    }
    if (messages.length) detail = " — " + messages.join("; ");
  } catch {
    // non-JSON error body
  }
  return `Jira API error ${response.status}${detail}`;
}
