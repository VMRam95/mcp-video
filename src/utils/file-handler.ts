/**
 * File handling utilities
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

/**
 * Get file size in bytes
 */
export function getFileSize(filePath: string): number {
  const stats = fs.statSync(filePath);
  return stats.size;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format seconds to MM:SS or HH:MM:SS string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get filename from path
 */
export function getFilename(filePath: string): string {
  return path.basename(filePath);
}

/**
 * Create a temporary directory for video processing
 */
export function createTempDir(prefix = 'mcp-video-'): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return tempDir;
}

/**
 * Clean up a temporary directory
 */
export function cleanupTempDir(tempDir: string): void {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Read file as base64
 */
export function readFileAsBase64(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
}

/**
 * Generate a hash for a file (for caching)
 */
export function generateFileHash(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('md5');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * List files in a directory with a specific extension
 */
export function listFilesWithExtension(dirPath: string, extension: string): string[] {
  const files = fs.readdirSync(dirPath);
  return files
    .filter(file => file.endsWith(extension))
    .map(file => path.join(dirPath, file))
    .sort();
}

/**
 * Ensure a directory exists, create if not
 */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get the MIME type for an image format
 */
export function getImageMimeType(format: 'jpeg' | 'jpg' | 'png' | 'webp'): string {
  const mimeTypes: Record<string, string> = {
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  return mimeTypes[format] || 'image/jpeg';
}

/**
 * Clear all contents from a video directory
 */
export function clearVideoDirectory(baseDir: string): void {
  if (!fs.existsSync(baseDir)) {
    return;
  }

  const items = fs.readdirSync(baseDir);
  for (const item of items) {
    const itemPath = path.join(baseDir, item);
    fs.rmSync(itemPath, { recursive: true, force: true });
  }
}

/**
 * Create a new video folder with timestamp and frames subdirectory
 */
export function createVideoFolder(baseDir: string): { folderPath: string; timestamp: string } {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const folderPath = path.join(baseDir, timestamp);
  const framesPath = path.join(folderPath, 'frames');

  ensureDir(folderPath);
  ensureDir(framesPath);

  return { folderPath, timestamp };
}

/**
 * Get the frames directory path for a video folder
 */
export function getFramesDir(videoFolder: string): string {
  const framesDir = path.join(videoFolder, 'frames');
  ensureDir(framesDir);
  return framesDir;
}
