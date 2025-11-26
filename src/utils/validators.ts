/**
 * Input validation utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { SUPPORTED_VIDEO_FORMATS, type VideoError, type SupportedVideoFormat } from '../types/index.js';

/**
 * Get the base directory for videos from environment variable
 */
export function getVideoBaseDir(): string | undefined {
  return process.env.VIDEO_BASE_DIR;
}

/**
 * Check if a file exists at the given path
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve a video path - handles relative paths and missing extensions
 *
 * Logic:
 * 1. If path is absolute and exists → use it
 * 2. If path is relative → prepend VIDEO_BASE_DIR
 * 3. If no extension → try all supported extensions
 *
 * @returns The resolved absolute path or null if not found
 */
export function resolveVideoPath(inputPath: string): string | null {
  const baseDir = getVideoBaseDir();

  // Helper to check path with optional extension search
  const findWithExtensions = (basePath: string): string | null => {
    // First, try the path as-is
    if (fileExists(basePath)) {
      return basePath;
    }

    // If no extension, try all supported formats
    const ext = path.extname(basePath).toLowerCase();
    if (!ext) {
      for (const format of SUPPORTED_VIDEO_FORMATS) {
        const pathWithExt = basePath + format;
        if (fileExists(pathWithExt)) {
          return pathWithExt;
        }
      }
    }

    return null;
  };

  // Case 1: Absolute path
  if (path.isAbsolute(inputPath)) {
    return findWithExtensions(inputPath);
  }

  // Case 2: Path starts with ~ (home directory)
  if (inputPath.startsWith('~')) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const expandedPath = path.join(homeDir, inputPath.slice(1));
    return findWithExtensions(expandedPath);
  }

  // Case 3: Relative path - use VIDEO_BASE_DIR if set
  if (baseDir) {
    const fullPath = path.join(baseDir, inputPath);
    return findWithExtensions(fullPath);
  }

  // Case 4: No base dir, try relative to cwd
  const cwdPath = path.resolve(inputPath);
  return findWithExtensions(cwdPath);
}

/**
 * List available videos in the base directory
 */
export function listAvailableVideos(): string[] {
  const baseDir = getVideoBaseDir();
  if (!baseDir || !fs.existsSync(baseDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(baseDir);
    return files.filter(file => {
      const ext = path.extname(file).toLowerCase() as SupportedVideoFormat;
      return SUPPORTED_VIDEO_FORMATS.includes(ext);
    });
  } catch {
    return [];
  }
}

/**
 * Check if the file extension is a supported video format
 */
export function isSupportedFormat(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase() as SupportedVideoFormat;
  return SUPPORTED_VIDEO_FORMATS.includes(ext);
}

/**
 * Get the file extension
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

/**
 * Validate a video file path and resolve it
 * Returns { error: null, resolvedPath: string } if valid
 * Returns { error: VideoError, resolvedPath: null } if invalid
 */
export function validateVideoPath(filePath: string): VideoError | null {
  // Check if path is provided
  if (!filePath || typeof filePath !== 'string') {
    return {
      code: 'INVALID_PATH',
      message: 'Video path is required',
      suggestion: 'Provide a valid file path to a video file',
    };
  }

  // Try to resolve the path (handles VIDEO_BASE_DIR and missing extensions)
  const resolvedPath = resolveVideoPath(filePath);

  // Check if file was found
  if (!resolvedPath) {
    const baseDir = getVideoBaseDir();
    const availableVideos = listAvailableVideos();

    let suggestion = 'Check that the file path is correct and the file exists.';

    if (baseDir) {
      suggestion = `Video not found in ${baseDir}.`;
      if (availableVideos.length > 0) {
        suggestion += ` Available videos: ${availableVideos.join(', ')}`;
      } else {
        suggestion += ' No videos found in this directory.';
      }
    }

    return {
      code: 'FILE_NOT_FOUND',
      message: `Video not found: ${filePath}`,
      suggestion,
    };
  }

  // Check if format is supported
  if (!isSupportedFormat(resolvedPath)) {
    const ext = getFileExtension(resolvedPath);
    return {
      code: 'UNSUPPORTED_FORMAT',
      message: `Unsupported video format: ${ext}`,
      details: { extension: ext },
      suggestion: `Supported formats: ${SUPPORTED_VIDEO_FORMATS.join(', ')}`,
    };
  }

  return null;
}

/**
 * Validate numeric range
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): VideoError | null {
  if (typeof value !== 'number' || isNaN(value)) {
    return {
      code: 'INVALID_PATH',
      message: `${fieldName} must be a number`,
      suggestion: `Provide a number between ${min} and ${max}`,
    };
  }

  if (value < min || value > max) {
    return {
      code: 'INVALID_PATH',
      message: `${fieldName} must be between ${min} and ${max}`,
      details: { value, min, max },
      suggestion: `Adjust ${fieldName} to be within the valid range`,
    };
  }

  return null;
}

/**
 * Validate extract frames options
 */
export function validateExtractFramesOptions(options: {
  path: string;
  interval?: number;
  max_frames?: number;
  quality?: number;
  width?: number;
  start_time?: number;
  end_time?: number;
}): VideoError | null {
  // Validate path
  const pathError = validateVideoPath(options.path);
  if (pathError) return pathError;

  // Validate interval
  if (options.interval !== undefined) {
    const intervalError = validateRange(options.interval, 0.1, 60, 'interval');
    if (intervalError) return intervalError;
  }

  // Validate max_frames
  if (options.max_frames !== undefined) {
    const maxFramesError = validateRange(options.max_frames, 1, 500, 'max_frames');
    if (maxFramesError) return maxFramesError;
  }

  // Validate quality
  if (options.quality !== undefined) {
    const qualityError = validateRange(options.quality, 1, 100, 'quality');
    if (qualityError) return qualityError;
  }

  // Validate width
  if (options.width !== undefined) {
    const widthError = validateRange(options.width, 100, 3840, 'width');
    if (widthError) return widthError;
  }

  // Validate time range
  if (options.start_time !== undefined && options.start_time < 0) {
    return {
      code: 'INVALID_PATH',
      message: 'start_time cannot be negative',
      suggestion: 'Provide a non-negative start time in seconds',
    };
  }

  if (options.end_time !== undefined && options.start_time !== undefined) {
    if (options.end_time <= options.start_time) {
      return {
        code: 'INVALID_PATH',
        message: 'end_time must be greater than start_time',
        suggestion: 'Ensure end_time is after start_time',
      };
    }
  }

  return null;
}

/**
 * Normalize a file path (resolve ~ and relative paths)
 */
export function normalizePath(filePath: string): string {
  // Expand ~ to home directory
  if (filePath.startsWith('~')) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    filePath = path.join(homeDir, filePath.slice(1));
  }

  return path.resolve(filePath);
}
