/**
 * Web Server for mcp-video
 *
 * Provides a web interface to interact with video analysis tools.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { getVideoInfo } from '../tools/get-video-info.js';
import { extractFrames } from '../tools/extract-frames.js';
import {
  checkFfmpegAvailable,
  checkFfprobeAvailable,
  compressVideo,
} from '../processors/ffmpeg-processor.js';
import { clearVideoDirectory, createVideoFolder } from '../utils/file-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const HOME_DIR = process.env.HOME || process.env.USERPROFILE || os.homedir();
const DEFAULT_VIDEO_DIR = path.join(HOME_DIR, 'Videos', 'mcp-video');

/**
 * Get the upload directory - uses VIDEO_BASE_DIR if set, otherwise ~/Videos/mcp-video
 */
function getUploadDir(): string {
  const videoBaseDir = process.env.VIDEO_BASE_DIR;
  if (videoBaseDir && fs.existsSync(videoBaseDir)) {
    return videoBaseDir;
  }
  // Use ~/Videos/mcp-video as sensible default
  if (!fs.existsSync(DEFAULT_VIDEO_DIR)) {
    fs.mkdirSync(DEFAULT_VIDEO_DIR, { recursive: true });
  }
  return DEFAULT_VIDEO_DIR;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

/**
 * Parse JSON body from request
 */
async function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Parse multipart form data for file upload
 */
async function parseMultipart(req: http.IncomingMessage): Promise<{ filename: string; filepath: string; folderPath: string; timestamp: string }> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);

    if (!boundaryMatch) {
      reject(new Error('No boundary found in content-type'));
      return;
    }

    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const boundaryBuffer = Buffer.from(`--${boundary}`);

        // Find the file content between boundaries
        let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length;
        const end = buffer.indexOf(boundaryBuffer, start + 1);

        if (end === -1) {
          reject(new Error('Invalid multipart data'));
          return;
        }

        // Extract headers and content
        const part = buffer.slice(start, end);
        const headerEnd = part.indexOf('\r\n\r\n');

        if (headerEnd === -1) {
          reject(new Error('Invalid multipart headers'));
          return;
        }

        const headers = part.slice(0, headerEnd).toString();
        const content = part.slice(headerEnd + 4, -2); // Remove trailing \r\n

        // Extract filename from headers
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        const originalFilename = filenameMatch ? filenameMatch[1] : 'video.mp4';

        // Clear video directory before uploading new video
        const uploadDir = getUploadDir();
        clearVideoDirectory(uploadDir);

        // Create timestamped folder for video and frames
        const { folderPath, timestamp } = createVideoFolder(uploadDir);

        // Save video in the folder with simplified name
        const ext = path.extname(originalFilename);
        const filepath = path.join(folderPath, `video${ext}`);

        // Write file
        fs.writeFileSync(filepath, content);

        resolve({ filename: originalFilename, filepath, folderPath, timestamp });
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

/**
 * Serve static files
 */
function serveStatic(res: http.ServerResponse, filePath: string): void {
  const publicDir = path.join(__dirname, 'public');
  const fullPath = path.join(publicDir, filePath === '/' ? 'index.html' : filePath);

  // Security: prevent directory traversal
  if (!fullPath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(fullPath);
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
}

/**
 * Handle API requests
 */
async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  endpoint: string
): Promise<void> {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, { error: 'Method not allowed' }, 405);
    return;
  }

  try {
    // Handle file upload separately (multipart/form-data)
    if (endpoint === '/api/upload') {
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        sendJson(res, { error: 'Content-Type must be multipart/form-data' }, 400);
        return;
      }

      const { filename, filepath: originalFilepath, folderPath, timestamp } = await parseMultipart(req);

      // Compress video
      let filepath = originalFilepath;
      const compressedPath = path.join(folderPath, 'video_compressed.mp4');
      try {
        const compressionResult = await compressVideo(originalFilepath, compressedPath, { crf: 28, preset: 'medium' });
        // Replace original with compressed if successful
        if (compressionResult.success) {
          fs.unlinkSync(originalFilepath);
          const newFilepath = originalFilepath.replace(/\.[^.]+$/, '.mp4');
          fs.renameSync(compressedPath, newFilepath);
          filepath = newFilepath; // Update filepath to compressed version
        }
      } catch (e) {
        // Keep original if compression fails
        console.error('Compression failed:', e);
      }

      // Get video info
      const infoResult = await getVideoInfo({ path: filepath });
      if (!infoResult.success) {
        sendJson(res, {
          success: false,
          error: infoResult.error,
        });
        return;
      }

      // Extract a thumbnail (1 frame at 1 second or start)
      let thumbnail: string | null = null;
      try {
        const thumbnailResult = await extractFrames({
          path: filepath,
          max_frames: 1,
          interval: 1,
          start_time: Math.min(1, infoResult.metadata.duration_seconds * 0.1),
          quality: 80,
          width: 400,
        });
        if (thumbnailResult.success && thumbnailResult.frames.length > 0) {
          thumbnail = `data:${thumbnailResult.frames[0].mime_type};base64,${thumbnailResult.frames[0].image}`;
        }
      } catch {
        // Thumbnail extraction failed, continue without it
      }

      sendJson(res, {
        success: true,
        filename,
        filepath,
        folderPath,
        timestamp,
        metadata: infoResult.metadata,
        thumbnail,
        uploadDir: getUploadDir(),
      });
      return;
    }

    const body = await parseBody(req) as Record<string, unknown>;

    switch (endpoint) {
      case '/api/video-info': {
        const result = await getVideoInfo({ path: body.path as string });
        sendJson(res, result);
        break;
      }

      case '/api/extract-frames': {
        const videoPath = body.path as string;
        // Extract folder path and create frames directory for persistence
        const videoFolder = path.dirname(videoPath);
        const framesDir = path.join(videoFolder, 'frames');

        const result = await extractFrames({
          path: videoPath,
          interval: body.interval as number | undefined,
          max_frames: body.max_frames as number | undefined,
          quality: body.quality as number | undefined,
          width: body.width as number | undefined,
          start_time: body.start_time as number | undefined,
          end_time: body.end_time as number | undefined,
          output_dir: framesDir,
        });
        sendJson(res, result);
        break;
      }

      case '/api/get-frames': {
        const videoDir = getUploadDir();
        const folders = fs.readdirSync(videoDir).filter(f =>
          fs.statSync(path.join(videoDir, f)).isDirectory()
        ).sort().reverse();

        if (folders.length === 0) {
          sendJson(res, { success: false, error: 'No videos found' });
          break;
        }

        const latestFolder = path.join(videoDir, folders[0]);
        const framesDir = path.join(latestFolder, 'frames');

        if (!fs.existsSync(framesDir)) {
          sendJson(res, { success: false, error: 'No frames extracted' });
          break;
        }

        const frameFiles = fs.readdirSync(framesDir)
          .filter(f => f.endsWith('.jpg'))
          .sort();

        const frames = frameFiles.map((f, i) => ({
          index: i,
          filename: f,
          path: path.join(framesDir, f)
        }));

        sendJson(res, {
          success: true,
          folderPath: latestFolder,
          framesDir,
          frames
        });
        break;
      }

      case '/api/list-videos': {
        const videoDir = getUploadDir();
        if (!fs.existsSync(videoDir)) {
          sendJson(res, { success: true, videos: [] });
          break;
        }

        const folders = fs.readdirSync(videoDir)
          .filter(f => fs.statSync(path.join(videoDir, f)).isDirectory())
          .sort()
          .reverse();

        const videos = folders.map(folder => {
          const folderPath = path.join(videoDir, folder);
          const files = fs.readdirSync(folderPath);
          const videoFile = files.find(f => /\.(mp4|mov|webm|avi)$/i.test(f));
          const framesDir = path.join(folderPath, 'frames');
          const hasFrames = fs.existsSync(framesDir) && fs.readdirSync(framesDir).length > 0;

          return {
            timestamp: folder,
            folderPath,
            videoFile: videoFile ? path.join(folderPath, videoFile) : null,
            hasFrames,
            frameCount: hasFrames ? fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg')).length : 0
          };
        });

        sendJson(res, { success: true, videos });
        break;
      }

      default:
        sendJson(res, { error: 'Not found' }, 404);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    sendJson(res, { success: false, error: { message } }, 500);
  }
}

/**
 * Main request handler
 */
function requestHandler(
  req: http.IncomingMessage,
  res: http.ServerResponse
): void {
  const url = req.url || '/';

  if (url.startsWith('/api/')) {
    handleApi(req, res, url).catch((err) => {
      console.error('API error:', err);
      sendJson(res, { error: 'Internal server error' }, 500);
    });
  } else {
    serveStatic(res, url);
  }
}

/**
 * Start the web server
 */
export async function startWebServer(): Promise<void> {
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

  const server = http.createServer(requestHandler);

  server.listen(PORT, () => {
    console.log(`\n  MCP Video Web Interface`);
    console.log(`  =======================`);
    console.log(`  Server running at: http://localhost:${PORT}`);
    console.log(`\n  Available endpoints:`);
    console.log(`    POST /api/video-info     - Get video metadata`);
    console.log(`    POST /api/extract-frames - Extract frames from video`);
    console.log(`\n  Press Ctrl+C to stop\n`);
  });
}

// Run if executed directly
startWebServer().catch(console.error);
