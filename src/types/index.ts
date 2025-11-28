/**
 * MCP Video - Type Definitions
 */

// ============================================================================
// Video Metadata Types
// ============================================================================

export interface VideoMetadata {
  filename: string;
  filepath: string;
  duration: string;           // "MM:SS" format
  duration_seconds: number;
  resolution: string;         // "1920x1080"
  width: number;
  height: number;
  fps: number;
  codec: string;
  audio_codec: string | null;
  file_size: string;          // Human readable "10.5 MB"
  file_size_bytes: number;
  has_audio: boolean;
  bitrate: string;
  creation_time?: string;
}

// ============================================================================
// Frame Extraction Types
// ============================================================================

export interface ExtractedFrame {
  index: number;
  timestamp: string;          // "MM:SS" format
  timestamp_seconds: number;
  image: string;              // base64 encoded
  mime_type: 'image/jpeg' | 'image/png';
}

export interface ExtractFramesOptions {
  path: string;
  interval?: number;          // Default: 2 seconds
  max_frames?: number;        // Default: 30
  quality?: number;           // Default: 75 (1-100)
  width?: number;             // Default: 800 pixels
  start_time?: number;        // Start extraction from (seconds)
  end_time?: number;          // End extraction at (seconds)
}

export interface ExtractFramesResult {
  metadata: VideoMetadata;
  frames: ExtractedFrame[];
  extraction_info: {
    total_frames_extracted: number;
    interval_used: number;
    quality: number;
    width: number;
  };
}

// ============================================================================
// Transcription Types (for future use)
// ============================================================================

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
  confidence: number;
}

export interface TranscribeOptions {
  path: string;
  language?: string;          // Default: "auto"
  include_timestamps?: boolean; // Default: true
  word_level?: boolean;       // Default: false
}

// ============================================================================
// Full Analysis Types
// ============================================================================

export interface AnalyzeVideoOptions {
  path: string;
  extract_frames?: boolean;   // Default: true
  transcribe_audio?: boolean; // Default: true
  frame_interval?: number;    // Default: 2
  max_frames?: number;        // Default: 30
  frame_quality?: number;     // Default: 75
  frame_width?: number;       // Default: 800
  audio_language?: string;    // Default: "auto"
}

export interface AnalyzeVideoResult {
  metadata: VideoMetadata;
  frames?: ExtractedFrame[];
  transcription?: TranscriptionResult;
}

// ============================================================================
// Single Frame Types
// ============================================================================

export interface GetFrameAtTimeOptions {
  path: string;
  timestamp: number;          // Seconds
  quality?: number;           // Default: 85
  width?: number;             // Default: 1280
}

export interface GetFrameAtTimeResult {
  frame: ExtractedFrame;
  metadata: VideoMetadata;
}

// ============================================================================
// Error Types
// ============================================================================

export type ErrorCode =
  | 'FILE_NOT_FOUND'
  | 'INVALID_PATH'
  | 'UNSUPPORTED_FORMAT'
  | 'FFMPEG_NOT_FOUND'
  | 'FFMPEG_ERROR'
  | 'TRANSCRIPTION_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR';

export interface VideoError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  suggestion?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface VideoProcessorConfig {
  ffmpegPath?: string;
  ffprobePath?: string;
  tempDir?: string;
  maxConcurrentProcesses?: number;
}

export interface TranscriptionConfig {
  backend: 'openai' | 'local' | 'none';
  openaiApiKey?: string;
  whisperModel?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
}

// ============================================================================
// Supported Formats
// ============================================================================

export const SUPPORTED_VIDEO_FORMATS = [
  '.mp4',
  '.webm',
  '.mov',
  '.avi',
  '.mkv',
  '.m4v',
  '.flv',
  '.wmv',
  '.gif',
  '.mpeg',
  '.mpg',
  '.3gp',
] as const;

export type SupportedVideoFormat = typeof SUPPORTED_VIDEO_FORMATS[number];

// ============================================================================
// FFprobe Raw Types
// ============================================================================

export interface FFprobeStream {
  index: number;
  codec_name?: string;
  codec_type: 'video' | 'audio' | 'subtitle' | 'data';
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  duration?: string;
  bit_rate?: string;
  channels?: number;
  sample_rate?: string;
}

export interface FFprobeFormat {
  filename: string;
  format_name: string;
  duration: string;
  size: string;
  bit_rate: string;
  tags?: {
    creation_time?: string;
    [key: string]: string | undefined;
  };
}

export interface FFprobeResult {
  streams: FFprobeStream[];
  format: FFprobeFormat;
}

// ============================================================================
// Video Folder Types
// ============================================================================

/**
 * Structure for a video folder with timestamp naming
 */
export interface VideoFolder {
  /** Folder path */
  folderPath: string;
  /** Timestamp used as folder name */
  timestamp: string;
  /** Path to the video file */
  videoPath: string;
  /** Path to frames directory */
  framesDir: string;
}

// ============================================================================
// Compression Types
// ============================================================================

/**
 * Result of video compression
 */
export interface CompressionResult {
  success: boolean;
  outputPath: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

// ============================================================================
// Video Upload Types
// ============================================================================

/**
 * Options for video upload and processing
 */
export interface VideoUploadOptions {
  /** Whether to compress the video */
  compress?: boolean;
  /** CRF value for compression (0-51, lower = better quality) */
  crf?: number;
  /** FFmpeg preset for compression speed */
  preset?: 'ultrafast' | 'fast' | 'medium' | 'slow';
  /** Whether to extract frames automatically */
  extractFrames?: boolean;
  /** Frame extraction options */
  frameOptions?: {
    interval?: number;
    maxFrames?: number;
    quality?: number;
    width?: number;
  };
}

// ============================================================================
// Persistent Frame Types
// ============================================================================

/**
 * Persistent frame information (saved to disk)
 */
export interface PersistentFrame {
  index: number;
  timestamp: string;
  timestamp_seconds: number;
  filePath: string;
  fileName: string;
}

/**
 * Result of frame extraction with persistence
 */
export interface PersistentFrameExtractionResult {
  success: boolean;
  videoFolder: string;
  framesDir: string;
  frames: PersistentFrame[];
  metadata: VideoMetadata;
}
