import blessed from 'blessed';
import type { Task } from './types';
import { typeLabel, ENERGY_NAMES, ALL_ENERGY_LEVELS } from './types';
import * as db from './db';
import type { ThemeColors } from './theme';
import { getTheme, nextTheme } from './theme';

// Parse CLI args
const cliTheme = process.argv.find(a => a.startsWith('--theme='));
const initThemeName = cliTheme ? cliTheme.split('=')[1] : 'grey';
const typesArg = process.argv.find(a => a.startsWith('--types='));
const DEFAULT_TYPES = ['thinking', 'build', 'design', 'admin'];
const DEFAULT_TYPE_INDEX = 2;

function parseTaskTypes(): string[] {
  if (!typesArg) return DEFAULT_TYPES;

  const seen = new Set<string>();
  const parsed = typesArg
    .split('=')
    .slice(1)
    .join('=')
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0 && t.length <= 20)
    .filter(t => {
      const key = t.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return parsed.length > 0 ? parsed : DEFAULT_TYPES;
}

const taskTypes: string[] = parseTaskTypes();

// Current theme colors - module-level, swapped on theme change
const initTheme = getTheme(initThemeName);
let C: ThemeColors = initTheme.colors;
let currentTheme = initTheme.name;

type Mode = 'queue' | 'focus' | 'add' | 'edit';

let mode: Mode = 'queue';
let sel = 0, editId: string | null = null, elapsed = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let toaster: ReturnType<typeof setTimeout> | null = null;
let an = '', ae = 1, at = Math.min(DEFAULT_TYPE_INDEX, taskTypes.length - 1);
let ef = 0, ee = 1, et = Math.min(DEFAULT_TYPE_INDEX, taskTypes.length - 1);

function p2(n: number) { return n < 10 ? '0' + n : '' + n; }
function ft(s: number) { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return h > 0 ? `${p2(h)}:${p2(m)}:${p2(sec)}` : `${p2(m)}:${p2(sec)}`; }
function ns() { return new Date().toLocaleTimeString('en-US', { hour12: false }); }
function cw() { return process.stdout.columns || 80; }
function iw(inset: number) { return Math.max(20, cw() - inset); }
function trunc(s: string, max: number) {
  if (max <= 0) return '';
  if (s.length <= max) return s;
  if (max <= 3) return s.slice(0, max);
  return s.slice(0, max - 3) + '...';
}
function fitPair(left: string, right: string, width: number, minPad = 1) {
  if (right.length >= width) return { left: '', pad: '', right: trunc(right, width) };
  const fittedLeft = trunc(left, width - right.length - minPad);
  return {
    left: fittedLeft,
    pad: ' '.repeat(Math.max(0, width - fittedLeft.length - right.length)),
    right,
  };
}

// Shortcuts for color tags
function fg(c: string) { return `{${c}-fg}`; }
function close(c: string) { return `{/${c}-fg}`; }

function pf() { return fg(C.primary); }
function pc() { return close(C.primary); }
function df() { return fg(C.dim); }
function dc() { return close(C.dim); }
function gf() { return fg(C.gray); }
function gc() { return close(C.gray); }
function of() { return fg(C.orange); }
function oc() { return close(C.orange); }

// ─── Content builders ──────────────────────────────────────

function sc() {
  const tasks = db.getQueued(), act = db.getActive(), st = db.getStats();
  const n = tasks.length + (act ? 1 : 0);
  const width = iw(2);
  const right = `TODAY:${st.today}  WEEK:${st.week}  ${ns()}`;
  const parts = fitPair(`TASK QUEUE v2.0  ${n === 1 ? '1 TASK' : `${n} TASKS`}`, right, width);
  return `${pf()}${parts.left}${pc()}${parts.pad}${gf()}${parts.right}${gc()}`;
}

function sp() { return `${df()}${'-'.repeat(Math.max(0, cw()))}${dc()}`; }

function pb() {
  const q = db.getQueued();
  if (q.length === 0) return '';
  const left = '> PULL NEXT TASK';
  const right = '[SPACE]';
  const parts = fitPair(left, right, iw(4));
  return `\n${pf()}${parts.left}${pc()}${parts.pad}${df()}${parts.right}${dc()}\n`;
}

function tl(t: Task) {
  const bar = ENERGY_NAMES[t.energy_level];
  const parts = fitPair(t.name, bar, iw(4));
  return `${parts.left}${parts.pad}${parts.right}`;
}

function dl() {
  if (mode === 'add') return '';
  const q = db.getQueued();
  if (q.length === 0 || sel >= q.length) return '';
  const t = q[sel];
  return `${gf()}TYPE:${typeLabel(t.task_type)}  ENERGY:${ENERGY_NAMES[t.energy_level]}${gc()}`;
}

function fc() {
  const width = iw(2);
  const items = mode === 'focus'
    ? ['[F]inish', '[R]eturn', '[SPACE] Swap', '[Q]uit focus']
    : mode === 'add'
      ? ['[ENTER] Add', '[UP/DOWN] Energy', '[LEFT/RIGHT] Type', '[ESC] Cancel']
      : ['[A]dd', '[UP/DOWN]', '[E]dit', '[D]elete', '[J/K] Reorder', '[SPACE] Pull', '[T]heme', '[Q]uit'];
  const full = items.join('  ');
  const compact = mode === 'queue'
    ? 'A Add  Up/Dn Move  E Edit  D Del  J/K Reorder  Space Pull  T Theme  Q Quit'
    : full;
  return `${gf()}${trunc(full.length <= width ? full : compact, width)}${gc()}`;
}

// ─── Add bar ───────────────────────────────────────────────

function abc(): string {
  const en = ALL_ENERGY_LEVELS[ae], ty = taskTypes[at];
  const cur = '_';
  const inputWidth = Math.max(10, iw(4) - 2);
  const namePart = an.length > 0
    ? `${pf()}${trunc(an, inputWidth)}${cur}${pc()}`
    : `${pf()}${cur}${pc()}${df()}  type task name...${dc()}`;
  return (
    `${pf()}>${pc()} ${namePart}\n` +
    `${df()}ENERGY:${dc()} ${pf()}${ENERGY_NAMES[en]}${pc()}` +
    `  ${df()}TYPE:${dc()} ${pf()}${typeLabel(ty)}${pc()}`
  );
}

// ─── Focus mode ────────────────────────────────────────────

function fh(act: Task) {
  const ts = `[${ft(elapsed)}]`, label = 'ACTIVE TASK';
  const parts = fitPair(label, ts, iw(4));
  return `${pf()}${parts.left}${pc()}${parts.pad}${of()}${parts.right}${oc()}`;
}
function fti() { return `${of()}ELAPSED: ${ft(elapsed)}${oc()}`; }
function fa() { return `  ${pf()}[F]${pc()}${gf()}inish${gc()}  ${pf()}[R]${pc()}${gf()}eturn${gc()}  ${pf()}[SPACE]${pc()}${gf()} Swap${gc()}`; }
function fs(act: Task) {
  let s = '';
  if (act.definition_of_done) s += `\n  ${df()}Definition of done:${dc()}\n  ${pf()}${act.definition_of_done}${pc()}\n`;
  if (act.sub_steps && act.sub_steps.length > 0) {
    s += `\n  ${df()}Steps:${dc()}\n`;
    act.sub_steps.forEach((step, i) => { s += `  ${gf()}[${p2(i + 1)}]${gc()} ${pf()}${step}${pc()}\n`; });
  }
  return s;
}

// ─── Edit form (overlay) ───────────────────────────────────

function efc() {
  if (!editId) return '';
  const task = db.getTask(editId);
  if (!task) return '';
  const es = ef === 0 ? `${pf()}< ${ENERGY_NAMES[ALL_ENERGY_LEVELS[ee]]} >${pc()}` : `${df()}  ${ENERGY_NAMES[ALL_ENERGY_LEVELS[ee]]}  ${dc()}`;
  const ts = ef === 1 ? `${pf()}< ${typeLabel(taskTypes[et])} >${pc()}` : `${df()}  ${typeLabel(taskTypes[et])}  ${dc()}`;
  return (
    `  ${df()}--- EDIT TASK -----------------------------------${dc()}\n` +
    `  ${gf()}Editing:${gc()} ${pf()}${trunc(task.name, iw(4) - 13)}${pc()}\n` +
    `  Energy: ${es}\n` +
    `  Type:   ${ts}\n` +
    `  ${gf()}[TAB] Next  [LEFT/RIGHT] Change  [ENTER] Save  [ESC] Cancel${gc()}`
  );
}

// ─── UI refs ───────────────────────────────────────────────

interface R {
  screen: blessed.Widgets.Screen;
  statusBar: blessed.Widgets.BlessedElement;
  statusLine: blessed.Widgets.BlessedElement;
  sep1: blessed.Widgets.BlessedElement;
  sep2: blessed.Widgets.BlessedElement;
  footer: blessed.Widgets.BlessedElement;
  pullBtn: blessed.Widgets.BlessedElement;
  queueBox: blessed.Widgets.BlessedElement;
  taskList: blessed.Widgets.ListElement;
  detailLine: blessed.Widgets.BlessedElement;
  addBar: blessed.Widgets.BlessedElement;
  focusBox: blessed.Widgets.BlessedElement;
  focusHeader: blessed.Widgets.BlessedElement;
  focusName: blessed.Widgets.BlessedElement;
  focusTimer: blessed.Widgets.BlessedElement;
  focusSteps: blessed.Widgets.BlessedElement;
  focusActions: blessed.Widgets.BlessedElement;
  editBox: blessed.Widgets.BlessedElement;
}
let ui: R = null!;

// ─── Theme application ─────────────────────────────────────

function applyThemeStyles(): void {
  ui.taskList.style!.item!.fg = C.primary;
  (ui.taskList.style!.selected as any).fg = C.primary;
  ui.screen.cursor.color = C.primary;
}

// ─── Refresh ───────────────────────────────────────────────

function refresh() {
  ui.statusBar.setContent(sc());
  ui.sep1.setContent(sp());
  ui.sep2.setContent(sp());
  ui.footer.setContent(fc());

  if (mode === 'focus') {
    const act = db.getActive();
    if (!act) { mode = 'queue'; refresh(); return; }
    ui.queueBox.hide(); ui.editBox.hide(); ui.focusBox.show(); ui.pullBtn.setContent('');
    ui.focusHeader.setContent(fh(act));
    ui.focusName.setContent(`${pf()}${trunc(act.name, iw(4))}${pc()}`);
    ui.focusTimer.setContent(fti());
    ui.focusSteps.setContent(fs(act));
    ui.focusActions.setContent(fa());
  } else if (mode === 'edit') {
    ui.queueBox.hide(); ui.focusBox.hide(); ui.editBox.show(); ui.pullBtn.setContent('');
    ui.editBox.setContent(efc());
  } else if (mode === 'add') {
    ui.queueBox.show(); ui.focusBox.hide(); ui.editBox.hide();
    (ui.queueBox as any).bottom = 6;
    ui.pullBtn.setContent('');
    ui.addBar.show();
    ui.addBar.setContent(abc());
    ui.detailLine.setContent('');
    const q = db.getQueued();
    if (q.length === 0) {
      ui.taskList.setItems([`${df()}(queue empty - type name below)${dc()}`]);
    } else {
      if (sel >= q.length) sel = Math.max(0, q.length - 1);
      ui.taskList.setItems(q.map(t => tl(t)));
      ui.taskList.select(sel);
    }
  } else {
    ui.focusBox.hide(); ui.editBox.hide(); ui.addBar.hide();
    (ui.queueBox as any).bottom = 4;
    ui.queueBox.show(); ui.pullBtn.setContent(pb());
    ui.detailLine.setContent(dl());

    const q = db.getQueued();
    if (q.length === 0) {
      ui.taskList.setItems([`${df()}(queue empty - press [A] to add)${dc()}`]);
    } else {
      if (sel >= q.length) sel = Math.max(0, q.length - 1);
      ui.taskList.setItems(q.map(t => tl(t)));
      ui.taskList.select(sel);
    }
  }
  ui.screen.render();
}

function toast(msg: string) {
  ui.statusLine.setContent(`${pf()}${msg.padEnd(cw() - 4)}${pc()}`);
  if (toaster) clearTimeout(toaster);
  toaster = setTimeout(() => { ui.statusLine.setContent(''); ui.screen.render(); }, 2500);
  ui.screen.render();
}

function goQueue() { if (timer) { clearInterval(timer); timer = null; } elapsed = 0; mode = 'queue'; refresh(); }

function goFocus() {
  const act = db.getActive();
  if (!act) { goQueue(); return; }
  mode = 'focus'; elapsed = 0;
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    elapsed++;
    if (!db.getActive()) { goQueue(); return; }
    ui.focusTimer.setContent(fti());
    ui.focusHeader.setContent(fh(db.getActive()!));
    ui.screen.render();
  }, 1000);
  refresh();
}

function cycleTheme(): void {
  const next = nextTheme(currentTheme);
  currentTheme = next.name;
  C = next.colors;
  applyThemeStyles();
  toast(`Theme: ${next.label}`);
  refresh();
}

// ─── Build ─────────────────────────────────────────────────

export function buildUI() {
  const screen = blessed.screen({
    smartCSR: true, title: 'Task Queue',
    cursor: { artificial: true, blink: true, shape: 'underline', color: C.primary },
    fastCSR: true, useBCE: true, forceUnicode: true,
  });

  const statusBar = tx(screen, { top: 0, left: 1, right: 1, height: 1 });
  const sep1 = tx(screen, { top: 1, left: 0, right: 0, height: 1 });
  const pullBtn = tx(screen, { top: 2, left: 2, right: 2, height: 3 });
  const queueBox = bx(screen, { top: 5, left: 0, right: 0, bottom: 4 });
  const taskList = blessed.list({
    parent: queueBox, top: 0, left: 2, right: 2, bottom: 0,
    keys: false, vi: false, tags: true, mouse: false,
    style: {
      selected: { fg: C.primary, bold: false, inverse: true },
      item: { fg: C.primary },
    },
  });
  const detailLine = tx(screen, { left: 2, right: 2, bottom: 4, height: 1 });
  const addBar = blessed.text({
    parent: screen, left: 2, right: 2, bottom: 4, height: 2,
    fg: C.primary, tags: true, hidden: true,
  });
  const sep2 = tx(screen, { bottom: 2, left: 0, right: 0, height: 1 });
  const footer = tx(screen, { bottom: 1, left: 1, right: 1, height: 1 });
  const statusLine = tx(screen, { bottom: 0, left: 1, right: 1, height: 1 });

  // Focus mode
  const focusBox = bx(screen, { top: 2, left: 2, right: 2, bottom: 2, hidden: true });
  const focusHeader = tx(focusBox, { top: 0, left: 0, right: 0, height: 1 });
  const focusName = tx(focusBox, { top: 2, left: 0, right: 0, height: 2 });
  const focusTimer = tx(focusBox, { top: 4, left: 0, right: 0, height: 2 });
  const focusSteps = blessed.text({
    parent: focusBox, top: 6, left: 0, right: 0, bottom: 3,
    fg: C.primary, tags: true, scrollable: true,
    scrollbar: { style: { fg: C.dim } },
  });
  const focusActions = tx(focusBox, { bottom: 0, left: 0, right: 0, height: 3 });

  // Edit overlay
  const editBox = bx(screen, { top: 2, left: 2, right: 2, bottom: 2, hidden: true, tags: true });

  ui = { screen, statusBar, statusLine, sep1, sep2, footer, pullBtn, queueBox, taskList, detailLine, addBar, focusBox, focusHeader, focusName, focusTimer, focusSteps, focusActions, editBox };
  applyThemeStyles();
  if (db.getActive()) goFocus();
  else goQueue();

  // ── Keyboard ────────────────────────────────────────

  screen.on('keypress', (ch: string, key: any) => {
    if (!key) return;
    const { name, shift } = key;

    // Global theme toggle
    if (name === 't' && shift && mode !== 'add' && mode !== 'edit') {
      cycleTheme();
      return;
    }

    if (mode === 'add') {
      if (name === 'escape') { goQueue(); return; }
      if (name === 'enter') {
        if (!an.trim()) { toast('Task name required'); return; }
        db.addTask(an.trim(), ALL_ENERGY_LEVELS[ae], taskTypes[at]);
        an = ''; toast('Task added'); goQueue(); return;
      }
      if (name === 'up') { ae = (ae + 1) % 3; refresh(); return; }
      if (name === 'down') { ae = (ae - 1 + 3) % 3; refresh(); return; }
      if (name === 'right') { at = (at + 1) % taskTypes.length; refresh(); return; }
      if (name === 'left') { at = (at - 1 + taskTypes.length) % taskTypes.length; refresh(); return; }
      if (name === 'backspace') { an = an.slice(0, -1); refresh(); return; }
      if (ch && ch.length === 1 && ch.charCodeAt(0) >= 32) { an += ch; refresh(); }
      return;
    }

    if (mode === 'edit') {
      if (name === 'escape') { goQueue(); return; }
      if (name === 'enter') {
        if (!editId) return;
        db.updateTask(editId, { energy_level: ALL_ENERGY_LEVELS[ee], task_type: taskTypes[et] });
        editId = null; toast('Task updated'); goQueue(); return;
      }
      if (name === 'tab') { ef = (ef + 1) % 2; refresh(); return; }
      if (name === 'left' || name === 'right') {
        const d = name === 'left' ? -1 : 1;
        if (ef === 0) ee = (ee + d + 3) % 3;
        else et = (et + d + taskTypes.length) % taskTypes.length;
        refresh(); return;
      }
      return;
    }

    if (mode === 'focus') {
      if (name === 'q' || name === 'escape') { db.returnActive(); toast('Returned to queue'); goQueue(); return; }
      if (name === 'f') { db.finishActive(); if (timer) { clearInterval(timer); timer = null; } toast('Task completed!'); goQueue(); return; }
      if (name === 'r') { db.returnActive(); if (timer) { clearInterval(timer); timer = null; } toast('Returned to queue'); goQueue(); return; }
      if (name === 'space' || name === 'enter') {
        if (db.getQueued().length === 0) { toast('No tasks to swap with'); return; }
        const swapped = db.swapFirst();
        if (swapped) { toast(`Swapped to: ${swapped.name}`); goFocus(); }
        return;
      }
      return;
    }

    // Queue mode
    if (name === 'k' && shift) {
      const q = db.getQueued();
      if (q.length > 0 && sel < q.length && db.reorderTask(q[sel].id, 'up')) { if (sel > 0) sel--; refresh(); }
      return;
    }
    if (name === 'j' && shift) {
      const q = db.getQueued();
      if (q.length > 0 && sel < q.length && db.reorderTask(q[sel].id, 'down')) { if (sel < db.getQueued().length - 1) sel++; refresh(); }
      return;
    }
    if (name === 'up' || (name === 'k' && !shift)) { if (sel > 0) { sel--; ui.taskList.select(sel); refresh(); } return; }
    if (name === 'down' || (name === 'j' && !shift)) { if (sel < db.getQueued().length - 1) { sel++; ui.taskList.select(sel); refresh(); } return; }
    if (name === 'space' || name === 'enter') { const p = db.pullNext(); if (p) { toast(`Pulled: ${p.name}`); goFocus(); } else toast('No tasks to pull'); return; }
    if (name === 'a') { mode = 'add'; ae = 1; at = Math.min(DEFAULT_TYPE_INDEX, taskTypes.length - 1); an = ''; refresh(); return; }
    if (name === 'e') {
      const q = db.getQueued();
      if (q.length === 0 || sel >= q.length) return;
      const t = q[sel]; editId = t.id; ef = 0;
      ee = ALL_ENERGY_LEVELS.indexOf(t.energy_level);
      et = taskTypes.indexOf(t.task_type);
      if (et < 0) et = 0;
      mode = 'edit'; refresh(); return;
    }
    if (name === 'd') {
      const q = db.getQueued();
      if (q.length === 0 || sel >= q.length) return;
      db.deleteTask(q[sel].id); toast('Deleted');
      if (sel >= db.getQueued().length) sel = Math.max(0, db.getQueued().length - 1);
      refresh(); return;
    }
    if (name === 'q') { process.exit(0); }
  });

  screen.on('resize', () => refresh());
  return { screen };
}

function tx(parent: any, opts: Record<string, unknown>) { return blessed.text({ parent, fg: C.primary, tags: true, ...opts } as any); }
function bx(parent: any, opts: Record<string, unknown>) { return blessed.box({ parent, ...opts } as any); }
