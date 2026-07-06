import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf-8'));

function runCli(args) {
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts', ...args], {
    cwd: root,
    encoding: 'utf-8',
  });
}

test('--version prints the package version without starting the TUI', () => {
  const result = runCli(['--version']);
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), pkg.version);
  assert.equal(result.stderr, '');
});

test('--help prints usage without starting the TUI', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /--theme=/);
  assert.match(result.stdout, /H History/);
  assert.equal(result.stderr, '');
});
