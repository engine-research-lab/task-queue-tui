#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const pkgDir = path.resolve(__dirname, '..');
const entry = path.join(pkgDir, 'src', 'index.ts');
const tsxCli = path.join(pkgDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const args = process.argv.slice(2); // pass through user args like --theme

const result = spawnSync(
  'node',
  [tsxCli, entry, ...args],
  { stdio: 'inherit', cwd: pkgDir }
);
process.exit(result.status ?? 0);
