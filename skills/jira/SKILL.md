---
name: jira
description: Jira issue management workflows. Use when creating, editing, or searching Jira issues. Defines required steps like fetching field metadata before creating issues.
---

# Jira Workflows

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

## JQL Search Patterns

Common JQL queries for `jira_search`:

- `assignee = currentUser()` — my issues
- `project = PROJ AND status = "In Progress"` — project issues by status
- `project = PROJ AND sprint in openSprints()` — current sprint
- `text ~ "search term"` — full-text search
- `created >= -7d` — recently created
- `updated >= -1d ORDER BY updated DESC` — recently updated

## Field Value Formats

When passing field values in `jira_create` or `jira_edit`:

- **Select/dropdown fields**: `{"value": "Option Name"}` or `{"name": "Option Name"}`
- **User fields**: `{"accountId": "..."}` (use `jira_users` to look up account IDs)
- **Priority**: `{"name": "P1 - Critical"}`
- **Labels**: `["label1", "label2"]` (array of strings)
- **Components**: `[{"name": "Component Name"}]`
- **Description**: Provide as plain markdown string (converted to ADF automatically)
