/**
 * extract_frames MCP Tool
 *
 * Extracts frames from a video at specified intervals.
 */

import { z } from 'zod';
import type { VideoMetadata, ExtractedFrame, VideoError } from '../types/index.js';
import { validateExtractFramesOptions, resolveVideoPath } from '../utils/validators.js';
import { cleanupTempDir } from '../utils/file-handler.js';
import {
  getVideoInfo as ffprobeGetInfo,
  parseVideoMetadata,
  extractFrames as ffmpegExtractFrames,
  createFfmpegError,
} from '../processors/ffmpeg-processor.js';

// Input schema for the tool
export const ExtractFramesInputSchema = z.object({
  path: z.string().describe('The path to the video file'),
  interval: z.number().min(0.1).max(60).optional()
    .describe('Seconds between frame captures (default: 2)'),
  max_frames: z.number().min(1).max(500).optional()
    .describe('Maximum number of frames to extract (default: 30)'),
  quality: z.number().min(1).max(100).optional()
    .describe('JPEG quality 1-100 (default: 75)'),
  width: z.number().min(100).max(3840).optional()
    .describe('Frame width in pixels, height auto-calculated (default: 800)'),
  start_time: z.number().min(0).optional()
    .describe('Start extraction from this time in seconds'),
  end_time: z.number().min(0).optional()
    .describe('End extraction at this time in seconds'),
});

export type ExtractFramesInput = z.infer<typeof ExtractFramesInputSchema>;

// Response type
export interface ExtractFramesResponse {
  success: true;
  metadata: VideoMetadata;
  frames: ExtractedFrame[];
  extraction_info: {
    total_frames_extracted: number;
    interval_used: number;
    quality: number;
    width: number;
  };
}

export interface ExtractFramesErrorResponse {
  success: false;
  error: VideoError;
}

export type ExtractFramesResult = ExtractFramesResponse | ExtractFramesErrorResponse;

/**
 * Extract frames from video
 */
export async function extractFrames(input: ExtractFramesInput): Promise<ExtractFramesResult> {
  // Apply defaults
  const options = {
    path: input.path,
    interval: input.interval ?? 2,
    max_frames: input.max_frames ?? 30,
    quality: input.quality ?? 75,
    width: input.width ?? 800,
    start_time: input.start_time,
    end_time: input.end_time,
  };

  // Validate input
  const validationError = validateExtractFramesOptions(options);
  if (validationError) {
    return {
      success: false,
      error: validationError,
    };
  }

  // Resolve the path (handles VIDEO_BASE_DIR and missing extensions)
  const resolvedPath = resolveVideoPath(options.path);
  if (!resolvedPath) {
    return {
      success: false,
      error: {
        code: 'FILE_NOT_FOUND',
        message: `Could not resolve video path: ${options.path}`,
      },
    };
  }

  let tempDir: string | null = null;

  try {
    // Get video metadata first
    const probeResult = await ffprobeGetInfo(resolvedPath);
    const metadata = parseVideoMetadata(resolvedPath, probeResult);

    // Validate time range against video duration
    if (options.start_time !== undefined && options.start_time >= metadata.duration_seconds) {
      return {
        success: false,
        error: {
          code: 'INVALID_PATH',
          message: `start_time (${options.start_time}s) exceeds video duration (${metadata.duration_seconds}s)`,
          suggestion: `Use a start_time less than ${metadata.duration_seconds} seconds`,
        },
      };
    }

    // Extract frames
    const result = await ffmpegExtractFrames(resolvedPath, {
      interval: options.interval,
      maxFrames: options.max_frames,
      quality: options.quality,
      width: options.width,
      startTime: options.start_time,
      endTime: options.end_time,
    });

    tempDir = result.tempDir;
    const frames = result.frames;

    // Cleanup temp directory
    cleanupTempDir(tempDir);

    return {
      success: true,
      metadata,
      frames,
      extraction_info: {
        total_frames_extracted: frames.length,
        interval_used: options.interval,
        quality: options.quality,
        width: options.width,
      },
    };
  } catch (error) {
    // Cleanup on error
    if (tempDir) {
      cleanupTempDir(tempDir);
    }

    return {
      success: false,
      error: createFfmpegError(error),
    };
  }
}

/**
 * Tool definition for MCP
 */
export const extractFramesToolDefinition = {
  name: 'extract_frames',
  description: 'Extract frames from a video file at specified intervals. Returns video metadata and an array of base64-encoded JPEG frames. You can pass just the video filename (e.g., "demo.mp4" or "demo") if VIDEO_BASE_DIR is configured.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'The video filename (e.g., "demo.mp4" or "demo") or full path. If just the name is provided, it will search in the configured VIDEO_BASE_DIR.',
      },
      interval: {
        type: 'number',
        description: 'Seconds between frame captures (default: 2, min: 0.1, max: 60)',
      },
      max_frames: {
        type: 'number',
        description: 'Maximum number of frames to extract (default: 30, min: 1, max: 500)',
      },
      quality: {
        type: 'number',
        description: 'JPEG quality 1-100 (default: 75)',
      },
      width: {
        type: 'number',
        description: 'Frame width in pixels, height is auto-calculated to maintain aspect ratio (default: 800)',
      },
      start_time: {
        type: 'number',
        description: 'Start extraction from this time in seconds (optional)',
      },
      end_time: {
        type: 'number',
        description: 'End extraction at this time in seconds (optional)',
      },
    },
    required: ['path'],
  },
};
