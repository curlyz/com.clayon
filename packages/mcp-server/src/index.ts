import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ClayonApiClient } from "./client.js";
import { readConfigFromEnv, type ClayonMcpConfig } from "./config.js";
import { createToolDefinitions } from "./tools.js";

export function createClayonMcpServer(config: ClayonMcpConfig = readConfigFromEnv()) {
  const server = new McpServer({
    name: "clayon",
    version: "0.1.0",
  });

  const client = new ClayonApiClient(config);
  const tools = createToolDefinitions(client);
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.schema.shape, tool.execute);
  }

  return {
    server,
    tools,
    client,
  };
}

export async function runServer(config: ClayonMcpConfig = readConfigFromEnv()) {
  const { server } = createClayonMcpServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
