/**
 * FFmpeg/FFprobe processor for video operations
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type {
  VideoMetadata,
  ExtractedFrame,
  FFprobeResult,
  VideoError,
  VideoProcessorConfig,
} from '../types/index.js';
import {
  formatBytes,
  formatDuration,
  getFilename,
  createTempDir,
  cleanupTempDir,
  readFileAsBase64,
  listFilesWithExtension,
} from '../utils/file-handler.js';
import { normalizePath } from '../utils/validators.js';

// Default configuration
const DEFAULT_CONFIG: VideoProcessorConfig = {
  ffmpegPath: 'ffmpeg',
  ffprobePath: 'ffprobe',
  tempDir: undefined,
  maxConcurrentProcesses: 2,
};

let config: VideoProcessorConfig = { ...DEFAULT_CONFIG };

/**
 * Set the processor configuration
 */
export function setConfig(newConfig: Partial<VideoProcessorConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Check if ffmpeg is available
 */
export async function checkFfmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn(config.ffmpegPath || 'ffmpeg', ['-version']);
    process.on('close', (code) => resolve(code === 0));
    process.on('error', () => resolve(false));
  });
}

/**
 * Check if ffprobe is available
 */
export async function checkFfprobeAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn(config.ffprobePath || 'ffprobe', ['-version']);
    process.on('close', (code) => resolve(code === 0));
    process.on('error', () => resolve(false));
  });
}

/**
 * Run ffprobe to get video information
 */
export async function getVideoInfo(filePath: string): Promise<FFprobeResult> {
  const normalizedPath = normalizePath(filePath);

  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      normalizedPath,
    ];

    const process = spawn(config.ffprobePath || 'ffprobe', args);
    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout) as FFprobeResult;
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse ffprobe output: ${error}`));
      }
    });

    process.on('error', (error) => {
      reject(new Error(`Failed to run ffprobe: ${error.message}`));
    });
  });
}

/**
 * Parse ffprobe result into VideoMetadata
 */
export function parseVideoMetadata(
  filePath: string,
  probeResult: FFprobeResult
): VideoMetadata {
  const normalizedPath = normalizePath(filePath);
  const videoStream = probeResult.streams.find((s) => s.codec_type === 'video');
  const audioStream = probeResult.streams.find((s) => s.codec_type === 'audio');
  const format = probeResult.format;

  // Parse duration
  const durationSeconds = parseFloat(format.duration) || 0;

  // Parse FPS from frame rate string (e.g., "30/1" or "29.97")
  let fps = 0;
  if (videoStream?.r_frame_rate) {
    const [num, den] = videoStream.r_frame_rate.split('/');
    fps = den ? parseInt(num) / parseInt(den) : parseFloat(num);
  }

  // Get file size
  const fileSizeBytes = parseInt(format.size) || 0;

  return {
    filename: getFilename(normalizedPath),
    filepath: normalizedPath,
    duration: formatDuration(durationSeconds),
    duration_seconds: durationSeconds,
    resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : 'unknown',
    width: videoStream?.width || 0,
    height: videoStream?.height || 0,
    fps: Math.round(fps * 100) / 100,
    codec: videoStream?.codec_name || 'unknown',
    audio_codec: audioStream?.codec_name || null,
    file_size: formatBytes(fileSizeBytes),
    file_size_bytes: fileSizeBytes,
    has_audio: !!audioStream,
    bitrate: format.bit_rate ? formatBytes(parseInt(format.bit_rate)) + '/s' : 'unknown',
    creation_time: format.tags?.creation_time,
  };
}

/**
 * Extract frames from video using ffmpeg
 */
export async function extractFrames(
  filePath: string,
  options: {
    interval?: number;
    maxFrames?: number;
    quality?: number;
    width?: number;
    startTime?: number;
    endTime?: number;
  } = {}
): Promise<{ frames: ExtractedFrame[]; tempDir: string }> {
  const normalizedPath = normalizePath(filePath);

  const {
    interval = 2,
    maxFrames = 30,
    quality = 75,
    width = 800,
    startTime,
    endTime,
  } = options;

  // Create temp directory for frames
  const tempDir = createTempDir();
  const outputPattern = path.join(tempDir, 'frame_%04d.jpg');

  try {
    // Build ffmpeg arguments
    const args: string[] = [];

    // Input seeking (before -i for faster seeking)
    if (startTime !== undefined && startTime > 0) {
      args.push('-ss', startTime.toString());
    }

    // Input file
    args.push('-i', normalizedPath);

    // Duration limit
    if (endTime !== undefined && startTime !== undefined) {
      const duration = endTime - startTime;
      args.push('-t', duration.toString());
    } else if (endTime !== undefined) {
      args.push('-t', endTime.toString());
    }

    // Video filter: fps and scale
    const filters: string[] = [];
    filters.push(`fps=1/${interval}`);
    filters.push(`scale=${width}:-1`);
    args.push('-vf', filters.join(','));

    // Output quality
    args.push('-q:v', Math.round((100 - quality) / 3.2 + 2).toString()); // Convert 1-100 to ffmpeg scale

    // Limit number of frames
    args.push('-frames:v', maxFrames.toString());

    // Output
    args.push(outputPattern);

    // Run ffmpeg
    await runFfmpeg(args);

    // Read extracted frames
    const frameFiles = listFilesWithExtension(tempDir, '.jpg');
    const frames: ExtractedFrame[] = [];

    for (let i = 0; i < frameFiles.length; i++) {
      const frameFile = frameFiles[i];
      const timestampSeconds = (startTime || 0) + i * interval;

      frames.push({
        index: i,
        timestamp: formatDuration(timestampSeconds),
        timestamp_seconds: timestampSeconds,
        image: readFileAsBase64(frameFile),
        mime_type: 'image/jpeg',
      });
    }

    return { frames, tempDir };
  } catch (error) {
    // Cleanup on error
    cleanupTempDir(tempDir);
    throw error;
  }
}

/**
 * Extract a single frame at a specific timestamp
 */
export async function extractFrameAtTime(
  filePath: string,
  timestamp: number,
  options: {
    quality?: number;
    width?: number;
  } = {}
): Promise<ExtractedFrame> {
  const normalizedPath = normalizePath(filePath);
  const { quality = 85, width = 1280 } = options;

  const tempDir = createTempDir();
  const outputPath = path.join(tempDir, 'frame.jpg');

  try {
    const args = [
      '-ss', timestamp.toString(),
      '-i', normalizedPath,
      '-frames:v', '1',
      '-vf', `scale=${width}:-1`,
      '-q:v', Math.round((100 - quality) / 3.2 + 2).toString(),
      outputPath,
    ];

    await runFfmpeg(args);

    if (!fs.existsSync(outputPath)) {
      throw new Error('Failed to extract frame - output file not created');
    }

    const frame: ExtractedFrame = {
      index: 0,
      timestamp: formatDuration(timestamp),
      timestamp_seconds: timestamp,
      image: readFileAsBase64(outputPath),
      mime_type: 'image/jpeg',
    };

    cleanupTempDir(tempDir);
    return frame;
  } catch (error) {
    cleanupTempDir(tempDir);
    throw error;
  }
}

/**
 * Run ffmpeg with given arguments
 */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const process = spawn(config.ffmpegPath || 'ffmpeg', ['-y', ...args]);
    let stderr = '';

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
        return;
      }
      resolve();
    });

    process.on('error', (error) => {
      reject(new Error(`Failed to run ffmpeg: ${error.message}`));
    });
  });
}

/**
 * Create a VideoError for ffmpeg-related issues
 */
export function createFfmpegError(error: unknown): VideoError {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('not found') || message.includes('ENOENT')) {
    return {
      code: 'FFMPEG_NOT_FOUND',
      message: 'ffmpeg is not installed or not in PATH',
      suggestion: 'Install ffmpeg: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)',
    };
  }

  return {
    code: 'FFMPEG_ERROR',
    message: `FFmpeg error: ${message}`,
    details: { originalError: message },
  };
}
