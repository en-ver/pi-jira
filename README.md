# pi-jira

Jira Cloud integration for [pi](https://github.com/badlogic/pi-mono) — gives the agent tools to search, read, create, edit issues and add comments via the Jira REST API v3.

## Installation

```bash
pi install git:github.com/en-ver/pi-jira
```

Or for development/testing:

```bash
pi -e ./extensions/jira.ts
```

## Configuration

Create a JSON config file in one of these locations:

| Location | Scope |
|----------|-------|
| `.pi/jira.json` | Project-local (takes priority) |
| `~/.pi/agent/jira.json` | Global (per-user) |

### Config format

```json
{
  "url": "$JIRA_URL",
  "email": "$JIRA_EMAIL",
  "apiToken": "$JIRA_API_TOKEN"
}
```

Values prefixed with `$` are resolved from environment variables. You can also use literal values:

```json
{
  "url": "https://mycompany.atlassian.net",
  "email": "you@company.com",
  "apiToken": "$JIRA_API_TOKEN"
}
```

A `config.example.json` is included in this package as a template.

### Getting a Jira API token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **Create API token**
3. Set the token as an environment variable (e.g., in `~/.bashrc` or `~/.zshrc`):

```bash
export JIRA_URL="https://mycompany.atlassian.net"
export JIRA_EMAIL="you@company.com"
export JIRA_API_TOKEN="your-api-token"
```

## Tools

### `jira_search`

Search Jira issues using JQL.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `jql` | string | yes | JQL query string |
| `maxResults` | number | no | Max issues to return (default 20, max 50) |
| `fields` | string[] | no | Fields to include |

### `jira_read`

Read a single issue with full details, description, and comments. Comments are returned inline with the issue data from `GET /rest/api/3/issue/{key}`. When more comments exist than the inline page returns, the output shows the total count and directs the agent to use `jira_comments` for the full list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `issueKey` | string | yes | Issue key (e.g., `PROJ-123`) |
| `includeComments` | boolean | no | Include comments (default true) |

### `jira_create`

Create a new issue. Description is provided in markdown and automatically converted to ADF.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | yes | Project key (e.g., `PROJ`) |
| `issueType` | string | yes | Issue type (e.g., `Bug`, `Task`, `Story`) |
| `summary` | string | yes | Issue title |
| `description` | string | no | Description in markdown |
| `fields` | object | no | Additional fields as key-value pairs |

### `jira_edit`

Update an existing issue. At least one of `summary`, `description`, or `fields` must be provided.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `issueKey` | string | yes | Issue key (e.g., `PROJ-123`) |
| `summary` | string | no | New summary |
| `description` | string | no | New description in markdown |
| `fields` | object | no | Additional fields to update |

### `jira_comment`

Add a comment to an issue. Body is provided in markdown and automatically converted to ADF.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `issueKey` | string | yes | Issue key (e.g., `PROJ-123`) |
| `body` | string | yes | Comment text in markdown |

### `jira_comments`

List comments on an issue with full pagination support. Use this when `jira_read` (which returns the first 50 comments) isn't enough — e.g., issues with many comments, or when you need a specific page or reverse ordering.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `issueKey` | string | yes | Issue key (e.g., `PROJ-123`) |
| `startAt` | number | no | Index of first comment to return (default 0) |
| `maxResults` | number | no | Max comments to return (default 50, max 100) |
| `orderBy` | string | no | `"created"` (oldest first, default) or `"-created"` (newest first) |

### `jira_projects`

List Jira projects. Optionally filter by name or key with a search query. Returns only project key and name to keep context compact.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | no | Filter by project name or key (case insensitive) |

### `jira_users`

Search for Jira users by name or email. Returns display name and account ID, which can be used in user fields like `assignee`, `reporter`, etc.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Search string to match against user name or email |
| `maxResults` | number | no | Max users to return (default 10, max 50) |

### `jira_fields`

Get field metadata for creating/editing issues. Without `issueType`, lists available issue types. With `issueType`, returns all fields including names, IDs, required/optional, schema types, and allowed values for dropdown fields.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectKey` | string | yes | Project key (e.g., `PROJ`) |
| `issueType` | string | no | Issue type name (omit to list types) |

## ADF conversion

Jira REST API v3 uses [Atlassian Document Format](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/) for rich text fields. This extension converts transparently:

- **Reading**: ADF → Markdown (via [adf-to-markdown](https://github.com/evolo-at/afd-to-markdown))
- **Writing**: Markdown → ADF (via [marklassian](https://github.com/jamsinclair/marklassian))

The agent reads and writes **markdown**. ADF conversion is handled automatically.

## License

MIT
