/**
 * get_video_info MCP Tool
 *
 * Returns metadata about a video file without processing frames or audio.
 */

import { z } from 'zod';
import type { VideoMetadata, VideoError } from '../types/index.js';
import { validateVideoPath, normalizePath } from '../utils/validators.js';
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

  const normalizedPath = normalizePath(input.path);

  try {
    // Get video info using ffprobe
    const probeResult = await ffprobeGetInfo(normalizedPath);
    const metadata = parseVideoMetadata(normalizedPath, probeResult);

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
  description: 'Get metadata about a video file including duration, resolution, codec, file size, and more. Does not extract frames or transcribe audio.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'The path to the video file (absolute or relative path)',
      },
    },
    required: ['path'],
  },
};
