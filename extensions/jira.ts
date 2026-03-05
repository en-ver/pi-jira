import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { type JiraConfig, loadConfig } from "./lib/config.js";
import { registerSearchTool } from "./tools/search.js";
import { registerReadTool } from "./tools/read.js";
import { registerCreateTool } from "./tools/create.js";
import { registerEditTool } from "./tools/edit.js";
import { registerCommentTool } from "./tools/comment.js";
import { registerCommentsTool } from "./tools/comments.js";
import { registerProjectsTool } from "./tools/projects.js";
import { registerFieldsTool } from "./tools/fields.js";
import { registerUsersTool } from "./tools/users.js";
import { registerAttachmentTool } from "./tools/attachment.js";

export default function (pi: ExtensionAPI) {
  // Config is loaded lazily on first tool call so ctx.cwd is available
  let config: JiraConfig | null = null;
  let configError: string | null = null;

  function getConfig(ctx: ExtensionContext): JiraConfig {
    if (configError) throw new Error(configError);
    if (config) return config;

    try {
      config = loadConfig(ctx.cwd);
      return config;
    } catch (err: any) {
      configError = err.message;
      throw err;
    }
  }

  // Reset cached config on session switch so project-local config is re-evaluated
  const resetConfig = async () => { config = null; configError = null; };
  pi.on("session_start", resetConfig);
  pi.on("session_switch", resetConfig);

  // Register all tools
  registerSearchTool(pi, getConfig);
  registerReadTool(pi, getConfig);
  registerCreateTool(pi, getConfig);
  registerEditTool(pi, getConfig);
  registerCommentTool(pi, getConfig);
  registerCommentsTool(pi, getConfig);
  registerProjectsTool(pi, getConfig);
  registerFieldsTool(pi, getConfig);
  registerUsersTool(pi, getConfig);
  registerAttachmentTool(pi, getConfig);
}
