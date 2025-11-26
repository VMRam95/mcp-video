/**
 * Input validation utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import { SUPPORTED_VIDEO_FORMATS, type VideoError, type SupportedVideoFormat } from '../types/index.js';

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
 * Validate a video file path
 * Returns null if valid, VideoError if invalid
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

  // Normalize the path
  const normalizedPath = path.resolve(filePath);

  // Check if file exists
  if (!fileExists(normalizedPath)) {
    return {
      code: 'FILE_NOT_FOUND',
      message: `File not found: ${normalizedPath}`,
      suggestion: 'Check that the file path is correct and the file exists',
    };
  }

  // Check if format is supported
  if (!isSupportedFormat(normalizedPath)) {
    const ext = getFileExtension(normalizedPath);
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
