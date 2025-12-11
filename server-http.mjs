// server-http.mjs
import http from "node:http";
import { spawn } from "node:child_process";
import { parse as parseUrl } from "node:url";

const PORT = process.env.PORT || 3000;

// Start MCP subprocess
const mcp = spawn("node", ["build/index.js"], {
  env: process.env,
  stdio: ["pipe", "pipe", "pipe"],
});

// Pending requests by id
const pending = new Map(); // id -> { res, timeout }
let jsonBuffer = "";

// SSE clients
const sseClients = new Set();

// Broadcast to SSE clients
function broadcastSse(msg) {
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {}
  }
}

// Handle MCP stdout messages
let braceDepth = 0;
mcp.stdout.on("data", (chunk) => {
  const text = chunk.toString("utf8");
  for (const char of text) {
    jsonBuffer += char;

    if (char === "{") braceDepth++;
    else if (char === "}") braceDepth--;

    if (braceDepth === 0 && jsonBuffer.trim()) {
      try {
        const msg = JSON.parse(jsonBuffer.trim());
        handleMcpMessage(msg);
      } catch {
        console.error("[MCP stdout invalid JSON]", jsonBuffer.trim());
      }
      jsonBuffer = "";
    }
  }
});

function handleMcpMessage(msg) {
  const hasId = Object.prototype.hasOwnProperty.call(msg, "id");

  if (hasId && pending.has(msg.id)) {
    const { res, timeout } = pending.get(msg.id);
    clearTimeout(timeout);
    pending.delete(msg.id);

    if (!res.writableEnded) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(msg));
    }
  } else {
    broadcastSse(msg);
  }
}

mcp.stderr.on("data", (chunk) => {
  console.error("[MCP stderr]", chunk.toString());
});

mcp.on("exit", (code, signal) => {
  console.error(`MCP exited (code=${code}, signal=${signal})`);
  for (const { res } of pending.values()) {
    if (!res.writableEnded) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "MCP exited" }));
    }
  }
  pending.clear();
});

// Graceful shutdown
function shutdown() {
  try {
    mcp.kill("SIGTERM");
  } catch {}
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// HTTP Server
const server = http.createServer((req, res) => {
  const url = parseUrl(req.url || "", true);

  // POST /mcp — JSON-RPC request
  if (req.method === "POST" && url.pathname === "/mcp") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1e6) req.destroy();
    });

    req.on("end", () => {
      let msg;
      try {
        msg = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Invalid JSON" }));
      }

      const hasId = Object.prototype.hasOwnProperty.call(msg, "id");

      if (hasId) {
        const timeout = setTimeout(() => {
          const entry = pending.get(msg.id);
          if (entry && !entry.res.writableEnded) {
            entry.res.writeHead(504, {
              "Content-Type": "application/json",
            });
            entry.res.end(
              JSON.stringify({ error: "Timeout waiting for MCP response" })
            );
          }
          pending.delete(msg.id);
        }, 60000);

        pending.set(msg.id, { res, timeout });

        // ---- Playground-safe initialize merge ----
        if (msg.method === "initialize") {
          const original = msg.params || {};

          msg.params = {
            ...original,
            protocolVersion: original.protocolVersion || "2024-11-05",
            clientInfo: original.clientInfo || {
              name: "openai-playground",
              version: "1.0",
            },
            capabilities: {
              ...(original.capabilities || {}),
            },
          };
        }

        try {
          mcp.stdin.write(JSON.stringify(msg) + "\n");
        } catch {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Failed to write to MCP" }));
        }
      } else {
        mcp.stdin.write(JSON.stringify(msg) + "\n");
        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ accepted: true }));
      }
    });

    return;
  }

  // GET /mcp — SSE stream
  if (req.method === "GET" && url.pathname === "/mcp") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    res.write("data: {}\n\n");
    sseClients.add(res);

    req.on("close", () => sseClients.delete(res));
    return;
  }

  // Health check
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  }

  // Fallback
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () =>
  console.log(`HTTP MCP wrapper listening on port ${PORT}`)
);

