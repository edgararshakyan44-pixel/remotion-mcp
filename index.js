#!/usr/bin/env node
/**
 * Remotion MCP Server
 * Exposes Remotion's rendering API as MCP tools:
 *   - bundle_project   : webpack-bundle a Remotion project
 *   - list_compositions: list all compositions in a bundle
 *   - render_video     : render a composition to a video file
 *   - render_still     : render a single frame as an image
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import path from "path";

// ── lazy imports so the server starts fast even if @remotion/* not installed ──
async function getBundler() {
  const { bundle } = await import("@remotion/bundler");
  return bundle;
}
async function getRenderer() {
  const { selectComposition, renderMedia, renderStill, getCompositions } =
    await import("@remotion/renderer");
  return { selectComposition, renderMedia, renderStill, getCompositions };
}

// ── MCP server setup ──────────────────────────────────────────────────────────
const server = new Server(
  { name: "remotion-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool definitions ──────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "bundle_project",
      description:
        "Bundle a Remotion project using Webpack. Returns the path to the bundle that you pass to other tools.",
      inputSchema: {
        type: "object",
        properties: {
          entryPoint: {
            type: "string",
            description: "Absolute path to the Remotion entry file (e.g. src/index.ts)",
          },
          outDir: {
            type: "string",
            description: "(Optional) Output directory for the bundle. Defaults to a temp dir.",
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
      description:
        "Render a Remotion composition to a video file (mp4, webm, mov, gif, etc.).",
      inputSchema: {
        type: "object",
        properties: {
          serveUrl: {
            type: "string",
            description: "Path to the bundle directory returned by bundle_project.",
          },
          compositionId: {
            type: "string",
            description: "The ID of the composition to render.",
          },
          outputLocation: {
            type: "string",
            description: "Absolute output file path, e.g. /out/video.mp4",
          },
          codec: {
            type: "string",
            description: "Codec: h264 | h265 | vp8 | vp9 | gif | prores | mp3 | aac | wav. Default: h264",
            default: "h264",
          },
          inputProps: {
            type: "object",
            description: "(Optional) JSON props passed to the composition.",
          },
          durationInFrames: {
            type: "number",
            description: "(Optional) Override composition duration in frames.",
          },
          fps: {
            type: "number",
            description: "(Optional) Override frames per second.",
          },
          width: {
            type: "number",
            description: "(Optional) Override width in pixels.",
          },
          height: {
            type: "number",
            description: "(Optional) Override height in pixels.",
          },
        },
        required: ["serveUrl", "compositionId", "outputLocation"],
      },
    },
    {
      name: "render_still",
      description: "Render a single frame of a Remotion composition as an image (png, jpeg, pdf, webp).",
      inputSchema: {
        type: "object",
        properties: {
          serveUrl: {
            type: "string",
            description: "Path to the bundle directory returned by bundle_project.",
          },
          compositionId: {
            type: "string",
            description: "The ID of the composition to render.",
          },
          outputLocation: {
            type: "string",
            description: "Absolute output file path, e.g. /out/frame.png",
          },
          frame: {
            type: "number",
            description: "Which frame number to render. Default: 0",
            default: 0,
          },
          imageFormat: {
            type: "string",
            description: "png | jpeg | pdf | webp. Default: png",
            default: "png",
          },
          inputProps: {
            type: "object",
            description: "(Optional) JSON props passed to the composition.",
          },
        },
        required: ["serveUrl", "compositionId", "outputLocation"],
      },
    },
  ],
}));

// ── Tool handlers ─────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // ── bundle_project ────────────────────────────────────────────────────
    if (name === "bundle_project") {
      const bundle = await getBundler();
      const bundlePath = await bundle({
        entryPoint: path.resolve(args.entryPoint),
        ...(args.outDir ? { outDir: path.resolve(args.outDir) } : {}),
        onProgress: () => {},
      });
      return {
        content: [
          {
            type: "text",
            text: `Bundle created successfully.\nBundle path: ${bundlePath}`,
          },
        ],
      };
    }

    // ── list_compositions ─────────────────────────────────────────────────
    if (name === "list_compositions") {
      const { getCompositions } = await getRenderer();
      const compositions = await getCompositions(args.serveUrl);
      const summary = compositions.map((c) =>
        `• ${c.id}  (${c.width}×${c.height}, ${c.fps}fps, ${c.durationInFrames} frames)`
      ).join("\n");
      return {
        content: [
          {
            type: "text",
            text: `Found ${compositions.length} composition(s):\n\n${summary}`,
          },
        ],
      };
    }

    // ── render_video ──────────────────────────────────────────────────────
    if (name === "render_video") {
      const { selectComposition, renderMedia } = await getRenderer();
      const composition = await selectComposition({
        serveUrl: args.serveUrl,
        id: args.compositionId,
        inputProps: args.inputProps ?? {},
      });

      // Apply overrides
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

      return {
        content: [
          {
            type: "text",
            text: `Video rendered successfully.\nOutput: ${path.resolve(args.outputLocation)}`,
          },
        ],
      };
    }

    // ── render_still ──────────────────────────────────────────────────────
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

      return {
        content: [
          {
            type: "text",
            text: `Still rendered successfully.\nOutput: ${path.resolve(args.outputLocation)}`,
          },
        ],
      };
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}\n${error.stack}` }],
      isError: true,
    };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
