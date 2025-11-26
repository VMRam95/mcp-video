# MCP Video Tool - Planning Document

## 1. Project Overview

### 1.1 Vision
Create an MCP (Model Context Protocol) server that enables Claude and other LLMs to "see" and understand video content by extracting frames as images and transcribing audio to text.

### 1.2 Problem Statement
LLMs cannot natively process video files. This tool bridges that gap by:
- Extracting key frames from videos as analyzable images
- Transcribing audio content to text
- Providing metadata about the video
- Offering flexible input methods for ease of use

### 1.3 Target Users
- Developers using Claude Code or other MCP-compatible tools
- Users who need to analyze video content with AI assistance
- Content creators needing video transcription and analysis

---

## 2. User Interaction Design

### 2.1 Input Methods

#### Method 1: File Path
```
Direct path to video file on local filesystem
Example: /Users/john/Videos/tutorial.mp4
```

#### Method 2: Drag & Drop (via supported interfaces)
```
- User drags video file to terminal/interface
- System captures the file path automatically
- Works with Claude Code terminal and compatible GUIs
```

#### Method 3: Copy-Paste
```
- Copy video file in Finder/Explorer
- Paste path or file reference
- System resolves to actual file path
```

#### Method 4: URL (Future enhancement)
```
- YouTube URLs
- Direct video URLs (.mp4, .webm, etc.)
- Requires youtube-dl/yt-dlp integration
```

### 2.2 Processing Options (User-Configurable)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `extract_frames` | boolean | `true` | Extract video frames as images |
| `transcribe_audio` | boolean | `true` | Transcribe audio to text |
| `frame_interval` | number | `2` | Seconds between frame captures |
| `max_frames` | number | `30` | Maximum frames to extract |
| `frame_quality` | number | `75` | JPEG quality (1-100) |
| `frame_width` | number | `800` | Resize frames to this width |
| `audio_language` | string | `"auto"` | Language hint for transcription |

### 2.3 Use Case Examples

#### Use Case 1: Visual Analysis Only
```json
{
  "extract_frames": true,
  "transcribe_audio": false,
  "frame_interval": 1,
  "max_frames": 60
}
```
*For: Silent videos, visual tutorials, security footage*

#### Use Case 2: Audio Only
```json
{
  "extract_frames": false,
  "transcribe_audio": true
}
```
*For: Podcasts, interviews, audio-heavy content*

#### Use Case 3: Full Analysis (Default)
```json
{
  "extract_frames": true,
  "transcribe_audio": true,
  "frame_interval": 2,
  "max_frames": 30
}
```
*For: Complete video understanding*

#### Use Case 4: High-Detail Visual
```json
{
  "extract_frames": true,
  "transcribe_audio": false,
  "frame_interval": 0.5,
  "max_frames": 100,
  "frame_quality": 90,
  "frame_width": 1280
}
```
*For: Detailed visual inspection, frame-by-frame analysis*

---

## 3. Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Client                              │
│                 (Claude Code, etc.)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │ MCP Protocol (stdio/SSE)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP Video Server                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Input     │  │  Processing │  │      Output         │  │
│  │  Handler    │──│    Engine   │──│    Formatter        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────┬─────────────────┬─────────────────────────────────┘
          │                 │
          ▼                 ▼
┌─────────────────┐ ┌─────────────────┐
│     ffmpeg      │ │     Whisper     │
│ (frame extract) │ │ (transcription) │
└─────────────────┘ └─────────────────┘
```

### 3.2 Component Details

#### Input Handler
- Validates file paths and URLs
- Handles different input methods (path, drag-drop, clipboard)
- Checks file existence and format support
- Extracts basic video metadata

#### Processing Engine
- **Frame Extractor**: Uses ffmpeg to extract frames
- **Audio Extractor**: Separates audio track
- **Transcriber**: Sends audio to Whisper for transcription
- **Sampler**: Intelligent frame selection (scene detection optional)

#### Output Formatter
- Converts frames to base64
- Structures response with metadata
- Handles pagination for large videos
- Formats transcription with timestamps

### 3.3 Directory Structure

```
mcp-video/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── server.ts                # MCP server setup
│   ├── tools/
│   │   ├── analyze-video.ts     # Main analysis tool
│   │   ├── extract-frames.ts    # Frame extraction tool
│   │   ├── transcribe-audio.ts  # Audio transcription tool
│   │   ├── get-video-info.ts    # Metadata tool
│   │   └── get-frame-at-time.ts # Single frame tool
│   ├── processors/
│   │   ├── ffmpeg-processor.ts  # ffmpeg wrapper
│   │   ├── whisper-client.ts    # Whisper integration
│   │   └── frame-sampler.ts     # Sampling logic
│   ├── utils/
│   │   ├── file-handler.ts      # File operations
│   │   ├── image-converter.ts   # Image processing
│   │   └── validators.ts        # Input validation
│   └── types/
│       └── index.ts             # TypeScript types
├── tests/
│   ├── unit/
│   └── integration/
├── docs/
│   └── API.md
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
└── PLANNING.md
```

---

## 4. MCP Tools Specification

### 4.1 Tool: `analyze_video`

**Description**: Complete video analysis with frames and/or transcription

**Parameters**:
```typescript
{
  path: string;              // Required: Video file path
  extract_frames?: boolean;  // Default: true
  transcribe_audio?: boolean;// Default: true
  frame_interval?: number;   // Default: 2 (seconds)
  max_frames?: number;       // Default: 30
  frame_quality?: number;    // Default: 75 (1-100)
  frame_width?: number;      // Default: 800 (pixels)
  audio_language?: string;   // Default: "auto"
}
```

**Response**:
```typescript
{
  metadata: {
    filename: string;
    duration: string;        // "MM:SS" format
    duration_seconds: number;
    resolution: string;      // "1920x1080"
    fps: number;
    codec: string;
    file_size: string;
  };
  frames?: Array<{
    index: number;
    timestamp: string;       // "MM:SS"
    timestamp_seconds: number;
    image: string;           // base64 encoded
    mime_type: string;       // "image/jpeg"
  }>;
  transcription?: {
    text: string;            // Full transcription
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
    language: string;
    confidence: number;
  };
}
```

### 4.2 Tool: `extract_frames`

**Description**: Extract only frames from video

**Parameters**:
```typescript
{
  path: string;
  interval?: number;         // Default: 2
  max_frames?: number;       // Default: 30
  quality?: number;          // Default: 75
  width?: number;            // Default: 800
  start_time?: number;       // Start extraction from (seconds)
  end_time?: number;         // End extraction at (seconds)
}
```

### 4.3 Tool: `transcribe_audio`

**Description**: Extract and transcribe only audio

**Parameters**:
```typescript
{
  path: string;
  language?: string;         // Default: "auto"
  include_timestamps?: boolean; // Default: true
  word_level?: boolean;      // Default: false
}
```

### 4.4 Tool: `get_video_info`

**Description**: Get video metadata without processing

**Parameters**:
```typescript
{
  path: string;
}
```

**Response**:
```typescript
{
  filename: string;
  duration: string;
  duration_seconds: number;
  resolution: string;
  fps: number;
  codec: string;
  audio_codec: string;
  file_size: string;
  file_size_bytes: number;
  has_audio: boolean;
  bitrate: string;
  creation_time?: string;
}
```

### 4.5 Tool: `get_frame_at_time`

**Description**: Get a single frame at specific timestamp

**Parameters**:
```typescript
{
  path: string;
  timestamp: number;         // Seconds
  quality?: number;          // Default: 85
  width?: number;            // Default: 1280
}
```

---

## 5. Technical Requirements

### 5.1 System Dependencies

| Dependency | Required | Purpose |
|------------|----------|---------|
| Node.js | Yes | Runtime (v18+) |
| ffmpeg | Yes | Video/audio processing |
| ffprobe | Yes | Video metadata (comes with ffmpeg) |

### 5.2 Transcription Backend Options

#### Option A: Whisper Local (whisper.cpp / whisper-node)
```
Pros:
- Privacy: Audio never leaves machine
- No API costs
- Works offline

Cons:
- Requires ~1-2GB for model
- Slower processing
- CPU/GPU intensive
```

#### Option B: OpenAI Whisper API
```
Pros:
- Fast processing
- High accuracy
- No local resources needed

Cons:
- Requires API key
- Costs money (~$0.006/minute)
- Audio sent to external server
```

#### Option C: Local Whisper via Python
```
Pros:
- Full control
- GPU acceleration with CUDA

Cons:
- Requires Python environment
- Complex setup
```

**Recommendation**: Support multiple backends with configuration:
```typescript
{
  "transcription_backend": "openai" | "local" | "none",
  "openai_api_key": "sk-...",        // If using OpenAI
  "whisper_model": "base" | "small" | "medium" | "large"  // If local
}
```

### 5.3 NPM Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "fluent-ffmpeg": "^2.1.2",
    "sharp": "^0.33.0",
    "openai": "^4.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/fluent-ffmpeg": "^2.1.21",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "tsx": "^4.0.0"
  }
}
```

### 5.4 Supported Video Formats

| Format | Extension | Support Level |
|--------|-----------|---------------|
| MP4 | .mp4 | Full |
| WebM | .webm | Full |
| MOV | .mov | Full |
| AVI | .avi | Full |
| MKV | .mkv | Full |
| GIF | .gif | Frames only |
| M4V | .m4v | Full |
| FLV | .flv | Full |
| WMV | .wmv | Full |

---

## 6. Frame Sampling Strategies

### 6.1 Strategy: Fixed Interval (Default)
```
Extract frame every N seconds
Simple, predictable, consistent coverage
```

### 6.2 Strategy: Scene Detection (Advanced)
```
Detect scene changes using ffmpeg filters
Better for videos with varying content
More intelligent but slower
```

### 6.3 Strategy: Keyframe Only
```
Extract only I-frames (keyframes)
Fast, follows video structure
May have uneven distribution
```

### 6.4 Implementation

```typescript
type SamplingStrategy = 'interval' | 'scene' | 'keyframe';

interface SamplingConfig {
  strategy: SamplingStrategy;
  interval?: number;           // For 'interval'
  scene_threshold?: number;    // For 'scene' (0.0-1.0)
  max_frames: number;
}
```

---

## 7. Error Handling

### 7.1 Error Categories

| Category | Example | Handling |
|----------|---------|----------|
| File Not Found | Invalid path | Clear error message with path |
| Unsupported Format | .xyz file | List supported formats |
| ffmpeg Missing | Not installed | Installation instructions |
| Transcription Failed | API error | Fallback or retry |
| Timeout | Long video | Partial results + warning |
| Memory | Large video | Streaming/chunking |

### 7.2 Error Response Format

```typescript
{
  error: {
    code: string;           // e.g., "FILE_NOT_FOUND"
    message: string;        // Human-readable message
    details?: any;          // Additional context
    suggestion?: string;    // How to fix
  }
}
```

---

## 8. Performance Considerations

### 8.1 Token Budget Management

| Content | Approximate Tokens |
|---------|-------------------|
| 1 frame (800px, JPEG 75%) | ~1,500-3,000 |
| 30 frames | ~45,000-90,000 |
| 1 min transcription | ~200-400 |

**Recommendations**:
- Default max_frames: 30 (manageable context)
- Reduce frame_width for more frames
- Lower quality for large videos
- Provide "summary mode" for long videos

### 8.2 Processing Time Estimates

| Video Length | Frames (30) | Transcription | Total |
|--------------|-------------|---------------|-------|
| 1 minute | ~2s | ~5-30s | ~10-35s |
| 5 minutes | ~3s | ~20-120s | ~25-125s |
| 30 minutes | ~5s | ~60-300s | ~70-310s |

*Transcription time varies by backend (local vs API)*

### 8.3 Caching Strategy

```typescript
interface CacheConfig {
  enabled: boolean;
  cache_dir: string;          // Default: ~/.mcp-video/cache
  max_size_mb: number;        // Default: 1000
  ttl_hours: number;          // Default: 24
}
```

Cache by:
- Video file hash (MD5)
- Processing parameters
- Results: frames + transcription

---

## 9. Security Considerations

### 9.1 File Access
- Only access files user explicitly provides
- No recursive directory scanning
- Validate paths are within allowed directories

### 9.2 API Keys
- Store in environment variables
- Never log API keys
- Support config file with restricted permissions

### 9.3 Temporary Files
- Use secure temp directory
- Clean up after processing
- Don't persist sensitive content

---

## 10. Implementation Phases

### Phase 1: Core MVP (Week 1)
- [ ] Project setup (TypeScript, MCP SDK)
- [ ] Basic `get_video_info` tool
- [ ] Basic `extract_frames` tool with ffmpeg
- [ ] File path input method
- [ ] Unit tests for core functions

### Phase 2: Transcription (Week 2)
- [ ] OpenAI Whisper API integration
- [ ] `transcribe_audio` tool
- [ ] Combined `analyze_video` tool
- [ ] Integration tests

### Phase 3: Polish (Week 3)
- [ ] Local Whisper support
- [ ] Caching system
- [ ] Error handling improvements
- [ ] Documentation
- [ ] Performance optimization

### Phase 4: Advanced Features (Future)
- [ ] URL support (YouTube, etc.)
- [ ] Scene detection sampling
- [ ] Batch processing
- [ ] GUI companion app
- [ ] Streaming for long videos

---

## 11. Configuration

### 11.1 MCP Server Configuration

Location: `~/.config/claude/mcp_servers.json`

```json
{
  "mcp-video": {
    "command": "node",
    "args": ["/path/to/mcp-video/dist/index.js"],
    "env": {
      "OPENAI_API_KEY": "sk-...",
      "TRANSCRIPTION_BACKEND": "openai",
      "WHISPER_MODEL": "base",
      "CACHE_ENABLED": "true",
      "CACHE_DIR": "~/.mcp-video/cache",
      "MAX_FRAMES_DEFAULT": "30",
      "FRAME_QUALITY_DEFAULT": "75"
    }
  }
}
```

### 11.2 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| OPENAI_API_KEY | If using OpenAI | - | OpenAI API key |
| TRANSCRIPTION_BACKEND | No | "openai" | "openai", "local", "none" |
| WHISPER_MODEL | No | "base" | Local whisper model size |
| CACHE_ENABLED | No | "true" | Enable result caching |
| CACHE_DIR | No | "~/.mcp-video/cache" | Cache directory |
| MAX_FRAMES_DEFAULT | No | "30" | Default max frames |
| FRAME_QUALITY_DEFAULT | No | "75" | Default JPEG quality |
| FFMPEG_PATH | No | "ffmpeg" | Custom ffmpeg path |

---

## 12. Testing Strategy

### 12.1 Unit Tests
- File validation
- Parameter parsing
- Output formatting
- Error handling

### 12.2 Integration Tests
- ffmpeg integration
- Whisper API integration
- Full pipeline tests

### 12.3 Test Videos
- Short video (5s) - quick tests
- Medium video (60s) - standard tests
- Long video (10min) - performance tests
- Audio-only - transcription tests
- Silent video - frame-only tests
- Various formats - compatibility tests

---

## 13. Success Metrics

| Metric | Target |
|--------|--------|
| Frame extraction time | < 5s for 30 frames |
| Transcription accuracy | > 95% (clear audio) |
| Memory usage | < 500MB |
| Supported formats | 10+ |
| Test coverage | > 80% |

---

## 14. Open Questions

1. **URL Support Priority**: Should YouTube/URL support be in MVP or future?
2. **GUI Component**: Build companion Electron app for drag-drop?
3. **Streaming**: Support for live streams?
4. **Local Whisper**: Which implementation? (whisper.cpp, whisper-node)
5. **Pricing Model**: If distributed, free or paid tier?

---

## 15. References

- [MCP SDK Documentation](https://modelcontextprotocol.io/docs)
- [ffmpeg Documentation](https://ffmpeg.org/documentation.html)
- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
- [fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)

---

*Document Version: 1.0*
*Created: 2024*
*Last Updated: 2024*
