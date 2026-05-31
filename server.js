#!/usr/bin/env node
/**
 * Remotion MCP — HTTP/SSE Cloud Server
 * Compatible with claude.ai cloud connectors (StreamableHTTP transport)
 *
 * Tools:
 *   bundle_project      – webpack-bundle a Remotion project
 *   list_compositions   – list compositions in a bundle
 *   render_video        – render a composition to video
 *   render_still        – render a single frame as image
 */

import express from "express";
import { randomUUID } from "crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";

const PORT = process.env.PORT || 3000;

// ── Tool definitions (shared) ────────────────────────────────────────────────
const TOOLS = [
  {
    name: "bundle_project",
    description:
      "Bundle a Remotion project using Webpack. Returns the bundle path used by other tools.",
    inputSchema: {
      type: "object",
      properties: {
        entryPoint: {
          type: "string",
          description: "Absolute path to the Remotion entry file (e.g. /app/src/index.ts)",
        },
        outDir: {
          type: "string",
          description: "(Optional) Output directory for the bundle.",
        },
      },
      required: ["entryPoint"],
    },
  },
  {
    name: "list_compositions",
    description: "List all compositions defined in a Remotion bundle.",
    inputSchema: {
      type: "object",
      properties: {
        serveUrl: {
          type: "string",
          description: "Path to the bundle directory returned by bundle_project.",
        },
      },
      required: ["serveUrl"],
    },
  },
  {
    name: "render_video",
    description: "Render a Remotion composition to a video file (mp4, webm, gif, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        serveUrl: { type: "string", description: "Path to the bundle directory." },
        compositionId: { type: "string", description: "Composition ID to render." },
        outputLocation: { type: "string", description: "Absolute output file path." },
        codec: {
          type: "string",
          description: "h264 | h265 | vp8 | vp9 | gif | prores | mp3 | aac. Default: h264",
          default: "h264",
        },
        inputProps: { type: "object", description: "(Optional) Props passed to composition." },
        durationInFrames: { type: "number", description: "(Optional) Override duration." },
        fps: { type: "number", description: "(Optional) Override FPS." },
        width: { type: "number", description: "(Optional) Override width." },
        height: { type: "number", description: "(Optional) Override height." },
      },
      required: ["serveUrl", "compositionId", "outputLocation"],
    },
  },
  {
    name: "render_still",
    description: "Render a single frame of a Remotion composition as an image.",
    inputSchema: {
      type: "object",
      properties: {
        serveUrl: { type: "string", description: "Path to the bundle directory." },
        compositionId: { type: "string", description: "Composition ID to render." },
        outputLocation: { type: "string", description: "Absolute output file path." },
        frame: { type: "number", description: "Frame number to render. Default: 0", default: 0 },
        imageFormat: {
          type: "string",
          description: "png | jpeg | pdf | webp. Default: png",
          default: "png",
        },
        inputProps: { type: "object", description: "(Optional) Props passed to composition." },
      },
      required: ["serveUrl", "compositionId", "outputLocation"],
    },
  },
];

// ── Lazy Remotion imports ────────────────────────────────────────────────────
async function getBundler() {
  const { bundle } = await import("@remotion/bundler");
  return bundle;
}
async function getRenderer() {
  const { selectComposition, renderMedia, renderStill, getCompositions } =
    await import("@remotion/renderer");
  return { selectComposition, renderMedia, renderStill, getCompositions };
}

// ── Tool handler ─────────────────────────────────────────────────────────────
async function handleTool(name, args) {
  if (name === "bundle_project") {
    const bundle = await getBundler();
    const bundlePath = await bundle({
      entryPoint: path.resolve(args.entryPoint),
      ...(args.outDir ? { outDir: path.resolve(args.outDir) } : {}),
      onProgress: () => {},
    });
    return `Bundle created successfully.\nBundle path: ${bundlePath}`;
  }

  if (name === "list_compositions") {
    const { getCompositions } = await getRenderer();
    const compositions = await getCompositions(args.serveUrl);
    const summary = compositions
      .map((c) => `• ${c.id}  (${c.width}×${c.height}, ${c.fps}fps, ${c.durationInFrames} frames)`)
      .join("\n");
    return `Found ${compositions.length} composition(s):\n\n${summary}`;
  }

  if (name === "render_video") {
    const { selectComposition, renderMedia } = await getRenderer();
    const composition = await selectComposition({
      serveUrl: args.serveUrl,
      id: args.compositionId,
      inputProps: args.inputProps ?? {},
    });
    if (args.durationInFrames) composition.durationInFrames = args.durationInFrames;
    if (args.fps) composition.fps = args.fps;
    if (args.width) composition.width = args.width;
    if (args.height) composition.height = args.height;

    await renderMedia({
      composition,
      serveUrl: args.serveUrl,
      codec: args.codec ?? "h264",
      outputLocation: path.resolve(args.outputLocation),
      inputProps: args.inputProps ?? {},
      onProgress: () => {},
    });
    return `Video rendered successfully.\nOutput: ${path.resolve(args.outputLocation)}`;
  }

  if (name === "render_still") {
    const { selectComposition, renderStill } = await getRenderer();
    const composition = await selectComposition({
      serveUrl: args.serveUrl,
      id: args.compositionId,
      inputProps: args.inputProps ?? {},
    });
    await renderStill({
      composition,
      serveUrl: args.serveUrl,
      output: path.resolve(args.outputLocation),
      frame: args.frame ?? 0,
      imageFormat: args.imageFormat ?? "png",
      inputProps: args.inputProps ?? {},
    });
    return `Still rendered successfully.\nOutput: ${path.resolve(args.outputLocation)}`;
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ── MCP Server factory ───────────────────────────────────────────────────────
function createMcpServer() {
  const server = new Server(
    { name: "remotion-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const text = await handleTool(name, args);
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  });

  return server;
}

// ── Express app ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", server: "remotion-mcp", version: "1.0.0" });
});

// MCP endpoint — stateless (new session per request)
app.all("/mcp", async (req, res) => {
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP handler error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Remotion MCP server running on port ${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
