#!/usr/bin/env tsx
/**
 * Task Queue TUI - terminal-native task queue manager.
 *
 * Run: npx tsx src/index.ts
 */

import * as fs from 'node:fs';
import { buildUI } from './ui.js';

const args = process.argv.slice(2);

function version(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function help(): string {
  return `task-queue-tui

A minimal terminal task queue for doing one task at a time.

Usage:
  tq [options]

Options:
  --theme=<grey|amber|slate>       Set color theme
  --types=<a,b,c>                  Set custom task types
  -h, --help                       Show help
  -v, --version                    Show version

Inside the TUI:
  A Add    E Edit    D Delete    U Undo delete
  H History    T Theme    Space Pull    Q Quit
`;
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(help());
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  console.log(version());
  process.exit(0);
}

// Build and start the TUI
const ui = buildUI();
ui.screen.render();
