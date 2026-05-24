# Roadmap & Recommendations

## New Features

### High-impact

- **Config file** (`~/.taskqueue/config.json`) — persist theme, custom types, and default energy so `tq` remembers preferences between sessions
- **Undo** — soft-delete or a 5-item undo stack for accidental deletes / finishes. stored in memory, not synced
- **Sub-steps** — add a checklist inside a task during focus mode. toggle with `s`, check off with `Space`. stores as `sub_steps` field (already in schema)
- **Search / filter** — `/` to filter tasks by name. narrows the queue list in real-time as you type

### Medium-impact

- **Archive** — keep completed tasks viewable via a toggle (`A` in queue). shows last 50
- **Stats panel** — inline stats toggled with `S`. shows tasks completed today / week / total, avg time per task, streak counter
- **Batch add** — paste multiple task names (one per line) to add them in bulk. uses default energy/type, then edit individually

### Low-impact / nice-to-have

- **Export / import** — `tq --export` writes queue to stdout as JSON, `tq --import < file` reads it back
- **Notifications** — desktop notification via `node-notifier` when timer hits 30min (optional opt-in)
- **Vim keybindings mode** — `tq --vi` swaps `j/k` behavior for movement-only, unbinds `J/K` reorder

## LOC Reduction

Current baseline: ~700 lines across 5 files.

### Consolidate color helpers

Replace per-color helpers (`pf()`, `pc()`, `df()`, `dc()`, etc.) with a single tag builder:

```ts
// before
`${pf()}hello${pc()} ${df()}world${dc()}`

// after
tag('primary', 'hello') + ' ' + tag('dim', 'world')
```

Saves ~30 lines. Keeps the tag abstraction but removes the 8 helper functions.

### Inline add/edit form sharing

`abc()` (add bar) and `efc()` (edit form) share the same layout pattern. Extract a shared form renderer:

```ts
function renderForm(lines: string[], activeField: number): string
```

Saves ~25 lines.

### Keyboard handler by mode

The single `screen.on('keypress')` callback is ~200 lines with nested conditionals. Extract each mode into its own function:

```ts
const handlers: Record<Mode, (ch: string, key: Key) => void> = {
  queue: handleQueueKey,
  focus: handleFocusKey,
  add: handleAddKey,
  edit: handleEditKey,
};
```

Saves ~15 lines (mostly whitespace from nesting). Makes the code flatter and easier to test.

### Strip blessed element creation boilerplate

`tx()` and `bx()` already reduce boilerplate for text/box creation. Extend to cover `list`, `scrollable text`:

```ts
function list(parent: any, opts: any) {
  return blessed.list({ parent, tags: true, keys: false, vi: false, mouse: false, ...opts });
}
```

Saves ~10 lines.

### Remove dead code

- `grf()` / `grc()` / `of()` / `oc()` — green/orange color helpers only used once or twice each. inline them.
- `ENERGY_BARS`, `TYPE_LABELS`, `TYPE_NAMES` — already removed from `types.ts`. confirm no stale references.

### Target

~650 lines after cleanup. The app is small by design — resist scope creep.

## Professional Polish

### Release checklist

- [ ] `--help` flag with usage summary
- [ ] `--version` flag that reads from `package.json`
- [ ] handle `SIGTERM` / `SIGINT` gracefully — restore terminal cursor, leave alternate screen buffer
- [ ] detect non-TTY stdin/stdout and print a one-line error instead of crashing with ANSI garbage
- [ ] man page (`docs/tq.1`) rendered from `--help` output

### Code quality

- [ ] add `"strict": true` TypeScript checks — already on, keep it
- [ ] `src/test.ts` harness for db operations — currently manual
- [ ] error boundary around `db.ts` file I/O — if `~/.taskqueue` is unwritable, show a toast instead of crashing
- [ ] validate `--types` input — reject empty strings, duplicates, names longer than 20 chars

### UX refinement

- [ ] **first-run welcome**: when the queue is empty and no tasks exist, show a 3-line quickstart instead of just `(queue empty — press [A] to add)`
- [ ] **confirmation on delete**: `[D]elete` currently deletes instantly. add `d d` (double-tap) or a confirmation prompt
- [ ] **exit confirmation**: if there's an active task, warn before quitting
- [ ] **responsive truncation**: task names longer than available width get `…` appended — already implemented, but test at very narrow terminals (< 40 cols)

## Keep It Professional

1. **No feature flags** — don't add config toggles for trivial things. either it works or it doesn't
2. **No animation** — no spinners, no progress bars, no transitions. this is a task queue, not a screensaver
3. **No telemetry** — don't track usage, don't phone home
4. **No dependencies on UI frameworks** — blessed is already a dependency. don't add ink, react, or any other renderer
5. **One file per concern** — currently 5 files (types, db, theme, ui, entry). adding a feature should not mean creating a new file unless it introduces a new concern (e.g. config)
6. **Terminal-native first** — every feature should work in any terminal. no mouse-dependent features, no true-color-only features without fallback
