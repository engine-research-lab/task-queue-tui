# `tq` — Terminal Task Queue

A keyboard-driven, terminal-native task queue that makes you work on **one thing at a time**.

Pull the top task → focus mode with timer → finish → next. No click, no cloud, no bloated UI. Just your terminal and a queue.

```
────────────────────────────────────────────────────────
TASK QUEUE v2.0  4 TASKS                 TODAY:0  WEEK:0  14:32
────────────────────────────────────────────────────────

→ PULL NEXT TASK                                  [SPACE]

Design login flow                                 MEDIUM
Implement API endpoints                             HIGH
Write documentation                                  LOW
Refactor auth middleware                          MEDIUM

────────────────────────────────────────────────────────
[A]dd  [↑/↓]  [E]dit  [D]elete  [J/K] Reorder  [SPACE] Pull  [Q]uit
```

## Install

```bash
npm install -g task-queue-tui
tq
```

Or from source:

```bash
git clone https://github.com/engine-research-lab/task-queue-tui.git && cd task-queue-tui && npm i && npm link && tq
```

Or run without installing:

```bash
npx task-queue-tui
```

Requires **Node 20+** and a terminal that supports 24-bit color.

## Usage

```bash
tq                              # grey (default)
tq --theme=amber                # warm retro
tq --theme=slate                # cool blue-grey
tq --types="dev,review,meeting" # custom task types
```

Press `T` (Shift+T) to cycle themes. Use `--types` to define your own task categories (default: `thinking,build,design,admin`).

## Keybindings

### Queue view

| Key | Action |
|-----|--------|
| `↑` `↓` / `j` `k` | Navigate tasks |
| `Space` / `Enter` | Pull next task into focus mode |
| `a` | Open inline add prompt |
| `e` | Edit selected task (energy / type) |
| `d` | Delete selected task |
| `J` (Shift+J) | Move task down in queue |
| `K` (Shift+K) | Move task up in queue |
| `T` (Shift+T) | Cycle theme (amber → grey → slate) |
| `q` | Quit |

### Focus mode (working on a task)

| Key | Action |
|-----|--------|
| `f` | Finish task (marks completed) |
| `r` | Return task to queue (goes to end) |
| `Space` / `Enter` | Swap with first queued task |
| `q` / `Esc` | Return to queue |

### Inline add prompt

| Key | Action |
|-----|--------|
| Type | Enter task name |
| `↑` / `↓` | Cycle energy level (MEDIUM → HIGH → LOW) |
| `←` / `→` | Cycle task type (based on `--types`, default: thinking → build → design → admin) |
| `Enter` | Add task |
| `Esc` | Cancel |

### Edit overlay

| Key | Action |
|-----|--------|
| `Tab` | Toggle between energy / type |
| `←` / `→` | Change value |
| `Enter` | Save |
| `Esc` | Cancel |

## Themes

| Theme | Primary | Dim | Vibe |
|-------|---------|-----|------|
| **Grey** (default) | `#cccccc` | `#888888` | Clean monochrome |
| **Mono Grey** | `#cccccc` | `#888888` | Clean monochrome |
| **Slate** | `#94a8b8` | `#5a6e7e` | Cool blue-grey |

Press `T` (Shift+T) to cycle through them.

## Data

Tasks are stored in `~/.taskqueue/tasks.json` as plain JSON. No database, no cloud, no account.

```json
[
  {
    "id": "abc123",
    "name": "Design login flow",
    "energy_level": "medium",
    "task_type": "design",
    "status": "queued",
    "position": 0,
    "created_at": "2026-05-24T03:01:41.771Z"
  }
]
```

To reset: `rm ~/.taskqueue/tasks.json`

## Project structure

```
src/
├── index.ts    # Entry point
├── types.ts    # Task type definitions
├── theme.ts    # Color themes (amber, grey, slate)
├── db.ts       # JSON file persistence + CRUD
└── ui.ts       # Blessed TUI screens + keyboard handling
```

~600 lines total. No React, no VDOM, no build step.

## Philosophy

- **Queue, not list** — FIFO ordering forces focus. Do the top task, then the next.
- **Keyboard-native** — every action has a key. No mouse, no clicking.
- **Terminal-native** — no boxes (no jagged resize), no background colors, respects your terminal theme.
- **Zero infrastructure** — single JSON file, no Supabase, no server, no API keys.

## License

AGPL
