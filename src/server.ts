/**
 * MCP Video Server
 *
 * Exposes video processing tools via the Model Context Protocol.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  getVideoInfo,
  getVideoInfoToolDefinition,
} from './tools/get-video-info.js';
import {
  extractFrames,
  extractFramesToolDefinition,
} from './tools/extract-frames.js';
import {
  checkFfmpegAvailable,
  checkFfprobeAvailable,
} from './processors/ffmpeg-processor.js';
import { resolveVideoPath } from './utils/validators.js';
import path from 'path';

// Server instance
let server: Server;

/**
 * Initialize and start the MCP server
 */
export async function startServer(): Promise<void> {
  // Check dependencies
  const ffmpegAvailable = await checkFfmpegAvailable();
  const ffprobeAvailable = await checkFfprobeAvailable();

  if (!ffmpegAvailable || !ffprobeAvailable) {
    console.error('ERROR: ffmpeg and/or ffprobe not found');
    console.error('Please install ffmpeg:');
    console.error('  macOS: brew install ffmpeg');
    console.error('  Linux: sudo apt install ffmpeg');
    console.error('  Windows: choco install ffmpeg');
    process.exit(1);
  }

  // Create server
  server = new Server(
    {
      name: 'mcp-video',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        getVideoInfoToolDefinition,
        extractFramesToolDefinition,
      ],
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'get_video_info': {
          const result = await getVideoInfo({
            path: args?.path as string,
          });

          if (result.success) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result.metadata, null, 2),
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: ${result.error.message}\n${result.error.suggestion || ''}`,
                },
              ],
              isError: true,
            };
          }
        }

        case 'extract_frames': {
          // Resolve video path to determine the frames directory
          const videoPath = args?.path as string;
          const resolvedPath = resolveVideoPath(videoPath);
          const framesDir = resolvedPath ? path.join(path.dirname(resolvedPath), 'frames') : undefined;

          const result = await extractFrames({
            path: videoPath,
            interval: args?.interval as number | undefined,
            max_frames: args?.max_frames as number | undefined,
            quality: args?.quality as number | undefined,
            width: args?.width as number | undefined,
            start_time: args?.start_time as number | undefined,
            end_time: args?.end_time as number | undefined,
            output_dir: framesDir,
          });

          if (result.success) {
            // Build response with metadata and frames
            const content: Array<{ type: 'text' | 'image'; text?: string; data?: string; mimeType?: string }> = [];

            // Add metadata as text
            content.push({
              type: 'text',
              text: `Video: ${result.metadata.filename}\nDuration: ${result.metadata.duration}\nResolution: ${result.metadata.resolution}\nFrames extracted: ${result.extraction_info.total_frames_extracted}`,
            });

            // Add each frame as an image
            for (const frame of result.frames) {
              content.push({
                type: 'image',
                data: frame.image,
                mimeType: frame.mime_type,
              });
            }

            return { content };
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: ${result.error.message}\n${result.error.suggestion || ''}`,
                },
              ],
              isError: true,
            };
          }
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Unexpected error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is for MCP communication)
  console.error('MCP Video server started');
}

/**
 * Stop the server
 */
export async function stopServer(): Promise<void> {
  if (server) {
    await server.close();
  }
}
