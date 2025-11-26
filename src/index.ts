#!/usr/bin/env node
/**
 * MCP Video - Entry Point
 *
 * An MCP server for video analysis - extract frames and transcribe audio.
 */

import { startServer } from './server.js';

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
