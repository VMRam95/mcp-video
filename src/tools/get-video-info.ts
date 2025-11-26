/**
 * get_video_info MCP Tool
 *
 * Returns metadata about a video file without processing frames or audio.
 */

import { z } from 'zod';
import type { VideoMetadata, VideoError } from '../types/index.js';
import { validateVideoPath, resolveVideoPath } from '../utils/validators.js';
import {
  getVideoInfo as ffprobeGetInfo,
  parseVideoMetadata,
  createFfmpegError,
} from '../processors/ffmpeg-processor.js';

// Input schema for the tool
export const GetVideoInfoInputSchema = z.object({
  path: z.string().describe('The path to the video file'),
});

export type GetVideoInfoInput = z.infer<typeof GetVideoInfoInputSchema>;

// Response type
export interface GetVideoInfoResponse {
  success: true;
  metadata: VideoMetadata;
}

export interface GetVideoInfoErrorResponse {
  success: false;
  error: VideoError;
}

export type GetVideoInfoResult = GetVideoInfoResponse | GetVideoInfoErrorResponse;

/**
 * Get video metadata
 */
export async function getVideoInfo(input: GetVideoInfoInput): Promise<GetVideoInfoResult> {
  // Validate input
  const validationError = validateVideoPath(input.path);
  if (validationError) {
    return {
      success: false,
      error: validationError,
    };
  }

  // Resolve the path (handles VIDEO_BASE_DIR and missing extensions)
  const resolvedPath = resolveVideoPath(input.path);
  if (!resolvedPath) {
    return {
      success: false,
      error: {
        code: 'FILE_NOT_FOUND',
        message: `Could not resolve video path: ${input.path}`,
      },
    };
  }

  try {
    // Get video info using ffprobe
    const probeResult = await ffprobeGetInfo(resolvedPath);
    const metadata = parseVideoMetadata(resolvedPath, probeResult);

    return {
      success: true,
      metadata,
    };
  } catch (error) {
    return {
      success: false,
      error: createFfmpegError(error),
    };
  }
}

/**
 * Tool definition for MCP
 */
export const getVideoInfoToolDefinition = {
  name: 'get_video_info',
  description: 'Get metadata about a video file including duration, resolution, codec, file size, and more. Does not extract frames or transcribe audio. You can pass just the video filename (e.g., "demo.mp4" or "demo") if VIDEO_BASE_DIR is configured.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'The video filename (e.g., "demo.mp4" or "demo") or full path. If just the name is provided, it will search in the configured VIDEO_BASE_DIR.',
      },
    },
    required: ['path'],
  },
};
