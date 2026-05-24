#!/usr/bin/env tsx
/**
 * Task Queue TUI — terminal-native task queue manager.
 *
 * Run: npx tsx src/index.ts
 */

import { buildUI } from './ui.js';

// Build and start the TUI
const ui = buildUI();
ui.screen.render();
