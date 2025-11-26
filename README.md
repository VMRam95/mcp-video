# MCP Video

An MCP (Model Context Protocol) server that enables LLMs to analyze video content by extracting frames and transcribing audio.

## Features

- **Frame Extraction**: Extract key frames from videos as base64-encoded images
- **Video Metadata**: Get duration, resolution, codec, file size, and more
- **Configurable**: Adjust frame interval, quality, resolution, and time range
- **Multiple Formats**: MP4, WebM, MOV, AVI, MKV, GIF, and more

## Current Status

**Phase 1 (MVP) - Complete:**
- [x] `get_video_info` - Get video metadata
- [x] `extract_frames` - Extract frames at intervals

**Phase 2 (Coming Soon):**
- [ ] `transcribe_audio` - Audio transcription with Whisper
- [ ] `analyze_video` - Combined frames + transcription

## Prerequisites

- Node.js >= 18
- ffmpeg installed on system

### Install ffmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows (with chocolatey)
choco install ffmpeg
```

## Installation

```bash
# Clone or navigate to the repository
cd mcp-video

# Install dependencies
npm install

# Build
npm run build
```

## Configuration for Claude Code

Add to your MCP settings file:

**Location:** `~/.claude/mcp_servers/mcp-video.json` (create if doesn't exist)

Or add to your Claude Code settings:

```json
{
  "mcpServers": {
    "mcp-video": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/Documentos/repositories/mcp-video/dist/index.js"]
    }
  }
}
```

Replace `YOUR_USERNAME` with your actual username.

## Available Tools

### `get_video_info`

Get metadata about a video file.

**Input:**
```typescript
{
  path: string  // Path to video file
}
```

**Output:**
```json
{
  "filename": "video.mp4",
  "duration": "02:30",
  "duration_seconds": 150,
  "resolution": "1920x1080",
  "fps": 30,
  "codec": "h264",
  "audio_codec": "aac",
  "file_size": "45.2 MB",
  "has_audio": true
}
```

### `extract_frames`

Extract frames from video at specified intervals.

**Input:**
```typescript
{
  path: string;          // Path to video file (required)
  interval?: number;     // Seconds between frames (default: 2)
  max_frames?: number;   // Max frames to extract (default: 30)
  quality?: number;      // JPEG quality 1-100 (default: 75)
  width?: number;        // Frame width in pixels (default: 800)
  start_time?: number;   // Start from this second
  end_time?: number;     // End at this second
}
```

**Output:**
- Video metadata as text
- Array of base64-encoded JPEG images

## Usage Examples

Once configured, you can use it in Claude Code:

```
"What's the duration and resolution of /path/to/video.mp4?"
→ Uses get_video_info

"Show me frames from /path/to/video.mp4 every 5 seconds"
→ Uses extract_frames with interval=5

"Extract the first 10 frames from /path/to/video.mp4"
→ Uses extract_frames with max_frames=10

"Get frames from 10 to 30 seconds of the video"
→ Uses extract_frames with start_time=10, end_time=30
```

## Supported Video Formats

| Format | Extension | Support |
|--------|-----------|---------|
| MP4 | .mp4 | Full |
| WebM | .webm | Full |
| MOV | .mov | Full |
| AVI | .avi | Full |
| MKV | .mkv | Full |
| GIF | .gif | Frames only |
| M4V | .m4v | Full |
| FLV | .flv | Full |
| WMV | .wmv | Full |
| MPEG | .mpeg, .mpg | Full |

## Development

```bash
# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Type check
npm run typecheck

# Run tests
npm test
```

## Project Structure

```
mcp-video/
├── src/
│   ├── index.ts              # Entry point
│   ├── server.ts             # MCP server setup
│   ├── tools/
│   │   ├── get-video-info.ts # Metadata tool
│   │   └── extract-frames.ts # Frame extraction tool
│   ├── processors/
│   │   └── ffmpeg-processor.ts # FFmpeg wrapper
│   ├── utils/
│   │   ├── validators.ts     # Input validation
│   │   └── file-handler.ts   # File operations
│   └── types/
│       └── index.ts          # TypeScript types
├── dist/                     # Compiled JavaScript
├── package.json
├── tsconfig.json
├── PLANNING.md               # Detailed architecture
└── README.md
```

## Documentation

See [PLANNING.md](./PLANNING.md) for detailed architecture, future roadmap, and implementation plans.

## License

MIT
