# MCP Video

An MCP (Model Context Protocol) server that enables LLMs to analyze video content by extracting frames and transcribing audio.

## Features

- **Frame Extraction**: Extract key frames from videos as images
- **Audio Transcription**: Transcribe video audio using OpenAI Whisper or local Whisper
- **Flexible Input**: Support for file paths, drag-drop, and copy-paste
- **Configurable**: Toggle video/audio processing, adjust quality and sampling
- **Multiple Formats**: MP4, WebM, MOV, AVI, MKV, and more

## Prerequisites

- Node.js >= 18
- ffmpeg installed on system
- OpenAI API key (for cloud transcription) or local Whisper setup

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
# Clone the repository
git clone https://github.com/yourusername/mcp-video.git
cd mcp-video

# Install dependencies
npm install

# Build
npm run build
```

## Configuration

Add to your MCP servers configuration (`~/.config/claude/mcp_servers.json`):

```json
{
  "mcp-video": {
    "command": "node",
    "args": ["/path/to/mcp-video/dist/index.js"],
    "env": {
      "OPENAI_API_KEY": "sk-your-key-here",
      "TRANSCRIPTION_BACKEND": "openai"
    }
  }
}
```

## Available Tools

### `analyze_video`
Complete video analysis with frames and transcription.

```typescript
{
  path: string;              // Video file path
  extract_frames?: boolean;  // Extract frames (default: true)
  transcribe_audio?: boolean;// Transcribe audio (default: true)
  frame_interval?: number;   // Seconds between frames (default: 2)
  max_frames?: number;       // Max frames to extract (default: 30)
}
```

### `extract_frames`
Extract only frames from video.

### `transcribe_audio`
Extract and transcribe only audio.

### `get_video_info`
Get video metadata (duration, resolution, codec, etc.)

### `get_frame_at_time`
Get a single frame at specific timestamp.

## Usage Examples

### Analyze a video (frames + audio)
```
"Analyze the video at /path/to/video.mp4"
```

### Visual analysis only
```
"Extract frames from /path/to/video.mp4 without audio"
```

### Audio transcription only
```
"Transcribe the audio from /path/to/podcast.mp4"
```

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Type check
npm run typecheck
```

## Documentation

See [PLANNING.md](./PLANNING.md) for detailed architecture and implementation plans.

## License

MIT
