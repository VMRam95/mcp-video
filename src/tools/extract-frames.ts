/**
 * extract_frames MCP Tool
 *
 * Extracts frames from a video at specified intervals.
 */

import { z } from 'zod';
import type { VideoMetadata, ExtractedFrame, VideoError } from '../types/index.js';
import { validateExtractFramesOptions, resolveVideoPath } from '../utils/validators.js';
import { cleanupTempDir, ensureDir, listFilesWithExtension, readFileAsBase64, formatDuration } from '../utils/file-handler.js';
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
  output_dir: z.string().optional()
    .describe('Directory to save frames persistently (if not provided, frames are temporary)'),
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
  frame_paths?: string[];
  output_directory?: string;
}

export interface ExtractFramesErrorResponse {
  success: false;
  error: VideoError;
}

export type ExtractFramesResult = ExtractFramesResponse | ExtractFramesErrorResponse;

/**
 * Check if frames already exist in a directory
 */
function getExistingFrames(dirPath: string): string[] {
  try {
    return listFilesWithExtension(dirPath, '.jpg');
  } catch {
    return [];
  }
}

/**
 * Read existing frames from disk and convert to ExtractedFrame format
 */
function readExistingFramesFromDisk(framePaths: string[], interval: number, startTime: number = 0): ExtractedFrame[] {
  const frames: ExtractedFrame[] = [];

  for (let i = 0; i < framePaths.length; i++) {
    const frameFile = framePaths[i];
    const timestampSeconds = startTime + i * interval;

    frames.push({
      index: i,
      timestamp: formatDuration(timestampSeconds),
      timestamp_seconds: timestampSeconds,
      image: readFileAsBase64(frameFile),
      mime_type: 'image/jpeg',
    });
  }

  return frames;
}

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
    output_dir: input.output_dir,
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
  const usePersistentOutput = !!options.output_dir;

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

    // Check for existing frames in output directory
    if (usePersistentOutput) {
      const existingFramePaths = getExistingFrames(options.output_dir!);

      if (existingFramePaths.length > 0) {
        // Reuse existing frames - no need to extract again
        const frames = readExistingFramesFromDisk(
          existingFramePaths,
          options.interval,
          options.start_time
        );

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
          frame_paths: existingFramePaths,
          output_directory: options.output_dir,
        };
      }

      // No existing frames, ensure directory exists for new extraction
      ensureDir(options.output_dir!);
    }

    // Extract frames (only if no existing frames found)
    const result = await ffmpegExtractFrames(resolvedPath, {
      interval: options.interval,
      maxFrames: options.max_frames,
      quality: options.quality,
      width: options.width,
      startTime: options.start_time,
      endTime: options.end_time,
      outputDir: options.output_dir,
    });

    tempDir = result.tempDir;
    const frames = result.frames;
    const framePaths = result.framePaths;

    // Cleanup temp directory only if NOT using persistent output
    if (!usePersistentOutput) {
      cleanupTempDir(tempDir);
    }

    const response: ExtractFramesResponse = {
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

    // Add persistent output information if applicable
    if (usePersistentOutput && framePaths) {
      response.frame_paths = framePaths;
      response.output_directory = options.output_dir;
    }

    return response;
  } catch (error) {
    // Cleanup on error (only if NOT using persistent output)
    if (tempDir && !usePersistentOutput) {
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
  description: `Extract frames from a video file at specified intervals. Returns video metadata and an array of base64-encoded JPEG frames. You can pass just the video filename (e.g., "demo.mp4" or "demo") if VIDEO_BASE_DIR is configured.

IMPORTANT - How to present video analysis:
- Frames are sequential snapshots from the video timeline
- Present your analysis as a TEMPORAL NARRATIVE describing what happens in the video
- Use flow words: "The video begins with...", "Then the user...", "Next...", "Finally..."
- DO NOT list frames separately (Frame 1, Frame 2...)
- DO NOT make a static inventory of screens/sections
- Describe it as a VIDEO with a sequence of events, actions, and transitions`,
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
      output_dir: {
        type: 'string',
        description: 'Directory to save frames persistently (optional). If not provided, frames are temporary and will be deleted after extraction.',
      },
    },
    required: ['path'],
  },
};
