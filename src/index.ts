// src/index.ts

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create the MCP server
const server = new McpServer({
  name: "gohighlevel-mcp-local",
  version: "1.0.0",
});

/**
 * Minimal, correct tool definition for your SDK version.
 *
 * NOTE:
 * - Use `server.tool(name, paramsShape, handler)`
 * - `paramsShape` is a plain object of Zod fields (NOT z.object(...)).
 * - Handler takes a single `params` arg with those fields.
 */
server.tool(
  "ping",
  {
    message: z.string().describe("Message to echo back."),
  },
  async ({ message }) => {
    return {
      content: [
        {
          type: "text",
          text: `pong: ${message}`,
        },
      ],
    };
  }
);

// Wire up stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);