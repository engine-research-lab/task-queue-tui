import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { Task, EnergyLevel, TaskStats } from './types';

let cache: Task[] | null = null;
let cachePath: string | null = null;

function getDbPath(): string {
  return process.env.TASKQUEUE_DB_PATH ?? path.join(os.homedir(), '.taskqueue', 'tasks.json');
}

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeTasks(filePath: string, tasks: Task[]): void {
  ensureDir(filePath);
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(tasks, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function backupInvalidFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.renameSync(filePath, `${filePath}.corrupt-${stamp}`);
}

function maxQueuedPosition(tasks: Task[]): number {
  return Math.max(
    -1,
    ...tasks
      .filter(t => t.status === 'queued' && Number.isFinite(t.position))
      .map(t => t.position),
  );
}

function normalizeTasks(tasks: Task[]): { tasks: Task[]; changed: boolean } {
  let changed = false;
  let hasActive = false;

  for (const task of tasks) {
    if (!Number.isFinite(task.position)) {
      task.position = maxQueuedPosition(tasks) + 1;
      changed = true;
    }

    if (task.status === 'active') {
      if (hasActive) {
        task.status = 'queued';
        task.completed_at = null;
        changed = true;
      } else {
        hasActive = true;
      }
    }
  }

  const queued = tasks
    .filter(t => t.status === 'queued')
    .sort((a, b) => a.position - b.position);

  queued.forEach((task, position) => {
    if (task.position !== position) {
      task.position = position;
      changed = true;
    }
  });

  return { tasks, changed };
}

function load(): Task[] {
  const dbPath = getDbPath();
  if (cache !== null && cachePath === dbPath) return cache;
  ensureDir(dbPath);
  try {
    const parsed = JSON.parse(fs.readFileSync(dbPath, 'utf-8')) as unknown;
    if (!Array.isArray(parsed)) {
      backupInvalidFile(dbPath);
      cache = [];
    } else {
      const normalized = normalizeTasks(parsed as Task[]);
      cache = normalized.tasks;
      if (normalized.changed) writeTasks(dbPath, cache);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      cache = [];
    } else if (error instanceof SyntaxError) {
      backupInvalidFile(dbPath);
      cache = [];
    } else {
      throw error;
    }
  }
  cachePath = dbPath;
  return cache;
}

function save(tasks: Task[]): void {
  const dbPath = getDbPath();
  const normalized = normalizeTasks(tasks);
  cache = normalized.tasks;
  cachePath = dbPath;
  writeTasks(dbPath, cache);
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Get queued tasks sorted by position */
export function getQueued(): Task[] {
  return load().filter(t => t.status === 'queued').sort((a, b) => a.position - b.position);
}

/** Get the active task */
export function getActive(): Task | null {
  return load().find(t => t.status === 'active') ?? null;
}

/** Get completed tasks, newest first */
export function getCompleted(limit = 50): Task[] {
  return load().filter(t => t.status === 'completed')
    .sort((a, b) => new Date(b.completed_at ?? b.created_at).getTime() - new Date(a.completed_at ?? a.created_at).getTime())
    .slice(0, limit);
}

/** Add a new queued task */
export function addTask(name: string, energy_level: EnergyLevel, task_type: string): Task {
  const tasks = load();
  const task: Task = {
    id: uid(), name, energy_level, task_type,
    definition_of_done: '', sub_steps: [],
    status: 'queued', position: maxQueuedPosition(tasks) + 1,
    created_at: new Date().toISOString(), completed_at: null,
  };
  tasks.push(task);
  save(tasks);
  return task;
}

/** Pull first queued task into active */
export function pullNext(): Task | null {
  const tasks = load();
  const active = tasks.find(t => t.status === 'active');
  if (active) return active;
  const next = tasks.filter(t => t.status === 'queued').sort((a, b) => a.position - b.position)[0];
  if (!next) return null;
  next.status = 'active';
  save(tasks);
  return next;
}

/** Finish the active task */
export function finishActive(): Task | null {
  const tasks = load();
  const active = tasks.find(t => t.status === 'active');
  if (!active) return null;
  active.status = 'completed';
  active.completed_at = new Date().toISOString();
  save(tasks);
  return active;
}

/** Return active task to end of queue */
export function returnActive(): Task | null {
  const tasks = load();
  const active = tasks.find(t => t.status === 'active');
  if (!active) return null;
  const nextPosition = maxQueuedPosition(tasks) + 1;
  active.status = 'queued';
  active.completed_at = null;
  active.position = nextPosition;
  save(tasks);
  return active;
}

/**
 * Swap active task with the first queued task.
 * Active goes to position 0 in queue, first queued becomes active.
 */
export function swapFirst(): Task | null {
  const tasks = load();
  const active = tasks.find(t => t.status === 'active');
  const next = tasks.filter(t => t.status === 'queued').sort((a, b) => a.position - b.position)[0];
  if (!active || !next) return null;

  // Swap statuses
  active.status = 'queued';
  next.status = 'active';

  // Active goes to front of queue, next was first so positions work out
  active.position = next.position;
  // next's position stays the same (it had the lowest position)

  save(tasks);
  return next;
}

/** Delete a task */
export function deleteTask(id: string): boolean {
  const tasks = load();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return false;
  tasks.splice(idx, 1);
  save(tasks);
  return true;
}

/** Restore a previously deleted task */
export function restoreTask(task: Task): Task | null {
  const tasks = load();
  if (tasks.some(t => t.id === task.id)) return null;

  const restored: Task = { ...task };
  if (restored.status === 'queued') {
    const position = Number.isFinite(restored.position) ? restored.position : maxQueuedPosition(tasks) + 1;
    for (const queued of tasks.filter(t => t.status === 'queued')) {
      if (queued.position >= position) queued.position++;
    }
    restored.position = position;
  }

  tasks.push(restored);
  save(tasks);
  return restored;
}

/** Update task fields */
export function updateTask(id: string, updates: Partial<Pick<Task, 'energy_level' | 'task_type' | 'name' | 'definition_of_done'>>): Task | null {
  const tasks = load();
  const task = tasks.find(t => t.id === id);
  if (!task) return null;
  Object.assign(task, updates);
  save(tasks);
  return task;
}

/** Move a task up or down */
export function reorderTask(id: string, direction: 'up' | 'down'): boolean {
  const tasks = load();
  const queued = tasks.filter(t => t.status === 'queued').sort((a, b) => a.position - b.position);
  const idx = queued.findIndex(t => t.id === id);
  if (idx === -1) return false;
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= queued.length) return false;
  const tmp = queued[idx].position;
  queued[idx].position = queued[swapIdx].position;
  queued[swapIdx].position = tmp;
  save(tasks);
  return true;
}

/** Clear all completed tasks */
export function clearCompleted(): void {
  save(load().filter(t => t.status !== 'completed'));
}

/** Get task statistics */
export function getStats(): TaskStats {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const completed = load().filter(t => t.status === 'completed');
  return {
    today: completed.filter(t => t.completed_at && t.completed_at >= todayStart).length,
    week: completed.filter(t => t.completed_at && t.completed_at >= weekStart).length,
    total: completed.length,
  };
}

/** Get a task by ID */
export function getTask(id: string): Task | null {
  return load().find(t => t.id === id) ?? null;
}
