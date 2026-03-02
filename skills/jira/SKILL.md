---
name: jira
description: Jira issue management workflows. Use when creating, editing, or searching Jira issues. Defines required steps like fetching field metadata before creating issues.
---

# Jira Workflows

## Available Tools

- `jira_search` — Search issues using JQL
- `jira_read` — Read a single issue with description and comments
- `jira_create` — Create a new issue
- `jira_edit` — Update an existing issue
- `jira_comment` — Add a comment to an issue
- `jira_comments` — List comments with pagination (when `jira_read`'s first 50 aren't enough)
- `jira_fields` — Get field metadata (issue types, required fields, allowed values)
- `jira_projects` — List projects (key + name), optionally filtered by search query
- `jira_users` — Search users by name or email, returns display name and account ID

## Creating an Issue

**Always follow these steps in order:**

0. **Resolve project key** — If the user provides a project name instead of a key, call `jira_projects` with the name as `query` to find the correct project key.
1. **Fetch field metadata** — Call `jira_fields` with `projectKey` and `issueType` to discover:
   - Which fields are **required** (the API will reject the request if any are missing)
   - What **allowed values** exist for dropdown/select fields (e.g., priority, custom fields)
   - The exact **field IDs** for custom fields (e.g., `customfield_11500`)
2. **Ask the user** for any required field values you don't already know. Show them the allowed values for dropdown fields so they can choose.
3. **Call `jira_create`** with all required fields. Pass custom fields via the `fields` parameter using their field IDs:
   ```
   fields: {"customfield_11500": {"value": "Product Team"}, "priority": {"name": "P2 - Major"}}
   ```

If you don't know the issue type, call `jira_fields` with just `projectKey` first to list available issue types.

## Editing an Issue

1. If you need to set dropdown/select fields, call `jira_fields` first to get allowed values.
2. Call `jira_edit` with the fields to update. You only need to provide the fields you're changing.
3. Description and summary can be passed directly. Custom fields go in the `fields` parameter.

## Reading an Issue

Call `jira_read` with the issue key. Description and comments are returned as markdown.

### Comments

`jira_read` returns comments inline with the issue data. In most cases this is sufficient — the majority of issues have few enough comments to fit in a single page. When more exist than returned, the output indicates the total and directs you to use `jira_comments` (e.g., "showing 20 of 120 — use jira_comments to fetch all").

For issues where you need **all** comments, use `jira_comments` — a dedicated tool backed by `GET /rest/api/3/issue/{key}/comment` with full pagination:
- `startAt` — offset for pagination (e.g., `startAt=50` for the second page)
- `maxResults` — up to 100 per call
- `orderBy` — `"created"` (oldest first) or `"-created"` (newest first)

Only use `jira_comments` when `jira_read` indicates truncation or when the user explicitly needs the full comment history.

## Searching Issues

Use `jira_search` with a JQL query. Common JQL patterns:

- `assignee = currentUser()` — my issues
- `project = PROJ AND status = "In Progress"` — project issues by status
- `project = PROJ AND sprint in openSprints()` — current sprint
- `text ~ "search term"` — full-text search
- `created >= -7d` — recently created
- `updated >= -1d ORDER BY updated DESC` — recently updated

## Adding Comments

Call `jira_comment` with the issue key and comment body in markdown.

## Field Value Formats

When passing field values in `jira_create` or `jira_edit`:

- **Select/dropdown fields**: `{"value": "Option Name"}` or `{"name": "Option Name"}`
- **User fields**: `{"accountId": "..."}` (use `jira_users` to look up account IDs)
- **Priority**: `{"name": "P1 - Critical"}`
- **Labels**: `["label1", "label2"]` (array of strings)
- **Components**: `[{"name": "Component Name"}]`
- **Description**: Provide as plain markdown string (converted to ADF automatically)
