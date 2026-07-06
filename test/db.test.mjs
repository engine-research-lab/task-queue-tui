import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const db = await import('../src/db.ts');

function useTempDb() {
  const dir = mkdtempSync(path.join(tmpdir(), 'tq-db-test-'));
  const dbPath = path.join(dir, 'tasks.json');
  process.env.TASKQUEUE_DB_PATH = dbPath;
  return { dir, dbPath };
}

function readTasks(dbPath) {
  return JSON.parse(readFileSync(dbPath, 'utf-8'));
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

test('new tasks get a finite queue position after all prior tasks are completed', () => {
  const { dir, dbPath } = useTempDb();
  try {
    db.addTask('Done', 'medium', 'build');
    db.pullNext();
    db.finishActive();

    const added = db.addTask('Next', 'medium', 'build');
    const saved = readTasks(dbPath).find(task => task.name === 'Next');

    assert.equal(added.position, 0);
    assert.equal(saved.position, 0);
  } finally {
    cleanup(dir);
  }
});

test('pullNext preserves the single-active-task invariant', () => {
  const { dir, dbPath } = useTempDb();
  try {
    const first = db.addTask('One', 'medium', 'build');
    db.addTask('Two', 'medium', 'build');

    assert.equal(db.pullNext()?.id, first.id);
    assert.equal(db.pullNext()?.id, first.id);

    const saved = readTasks(dbPath);
    assert.equal(saved.filter(task => task.status === 'active').length, 1);
    assert.deepEqual(
      saved.map(task => [task.name, task.status]),
      [['One', 'active'], ['Two', 'queued']],
    );
  } finally {
    cleanup(dir);
  }
});

test('legacy files with multiple active tasks are repaired on load', () => {
  const { dir, dbPath } = useTempDb();
  try {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    writeFileSync(
      dbPath,
      JSON.stringify([
        taskFixture({ id: 'one', name: 'One', status: 'active', position: 0 }),
        taskFixture({ id: 'two', name: 'Two', status: 'active', position: 1 }),
        taskFixture({ id: 'queued', name: 'Queued', status: 'queued', position: 5 }),
      ]),
      'utf-8',
    );

    assert.equal(db.getActive()?.name, 'One');
    assert.deepEqual(db.getQueued().map(task => task.name), ['Two', 'Queued']);

    const saved = readTasks(dbPath);
    assert.equal(saved.filter(task => task.status === 'active').length, 1);
    assert.deepEqual(
      saved
        .filter(task => task.status === 'queued')
        .map(task => [task.name, task.position]),
      [['Two', 0], ['Queued', 1]],
    );
  } finally {
    cleanup(dir);
  }
});

test('invalid JSON is backed up instead of overwritten', () => {
  const { dir, dbPath } = useTempDb();
  try {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    writeFileSync(dbPath, 'not-json', 'utf-8');

    assert.deepEqual(db.getQueued(), []);

    const backups = readdirSync(dir).filter(name => name.startsWith('tasks.json.corrupt-'));
    assert.equal(backups.length, 1);
    assert.equal(readFileSync(path.join(dir, backups[0]), 'utf-8'), 'not-json');
    assert.equal(existsSync(dbPath), false);

    db.addTask('Recovered', 'medium', 'build');
    assert.equal(readTasks(dbPath)[0].name, 'Recovered');
  } finally {
    cleanup(dir);
  }
});

test('restoreTask puts a deleted queued task back in order', () => {
  const { dir } = useTempDb();
  try {
    db.addTask('One', 'medium', 'build');
    const deleted = db.addTask('Two', 'medium', 'build');
    db.addTask('Three', 'medium', 'build');

    assert.equal(db.deleteTask(deleted.id), true);
    assert.deepEqual(db.getQueued().map(task => task.name), ['One', 'Three']);

    assert.equal(db.restoreTask(deleted)?.name, 'Two');
    assert.deepEqual(
      db.getQueued().map(task => [task.name, task.position]),
      [['One', 0], ['Two', 1], ['Three', 2]],
    );
  } finally {
    cleanup(dir);
  }
});

function taskFixture(overrides) {
  return {
    id: 'id',
    name: 'Task',
    energy_level: 'medium',
    task_type: 'build',
    definition_of_done: '',
    sub_steps: [],
    status: 'queued',
    position: 0,
    created_at: '2026-07-03T00:00:00.000Z',
    completed_at: null,
    ...overrides,
  };
}
