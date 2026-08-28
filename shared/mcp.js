import {
  MCP_CURRENT_PROTOCOL,
  MCP_PROTOCOLS,
  MCP_TOOLS,
  MCP_TOOL_INDEX,
  mcpDiscovery,
  mcpToolError,
  mcpToolPublic as baseToolPublic,
  mcpToolResult,
} from "./mcp-base.js";

export {
  MCP_CURRENT_PROTOCOL,
  MCP_PROTOCOLS,
  MCP_TOOLS,
  MCP_TOOL_INDEX,
  mcpDiscovery,
  mcpToolError,
  mcpToolResult,
};

export function mcpToolPublic(tool) {
  return Object.freeze({
    ...baseToolPublic(tool),
    requiredScopes: Object.freeze(["mcp:connect", ...tool.scopes]),
  });
}
