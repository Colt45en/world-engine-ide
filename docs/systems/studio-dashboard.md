# World Engine Studio Dashboard

## Purpose / Scope

The Studio Dashboard provides a single in-app “control room” view for the IDE at the `/dashboard` route. It is a **client-side** dashboard that simulates system health, a node graph, and a command terminal.

This dashboard is intended to be a high-signal operational UI for interactive exploration; it does not currently persist data or control real backend services.

## Architecture

Components are implemented together in one React module:

- **TopBar**: Displays identity + lightweight health indicators.
- **LeftSidebar**: Tool panel with an Inspector section and a small set of text utilities.
- **NodeGraph**: Canvas-based animated node graph and click-to-select inspector integration.
- **PerformancePanel**: Live metrics charts and event list.
- **Terminal**: Command input/output log with a small shell-like command set.
- **MobileNav**: Bottom tab navigation for smaller viewports.

The module also includes:

- `MockBackendService`: In-memory, deterministic-ish demo data for the “Database” section.

## Data Model / IR

### Nodes

A node is a mutable object used for rendering and selection:

- `id: string` (unique)
- `label?: string`
- `x, y: number` (canvas coordinates)
- `vx, vy: number` (velocity)
- `radius: number`
- `connections: string[]` (node ids)
- `type: 'core' | 'leaf' | 'infected'`
- `selected: boolean`

### Logs

Terminal logs are stored as:

- `id: string` (stable key)
- `type: 'info' | 'system' | 'success' | 'warning' | 'error'`
- `content: string`

### Metrics

Metrics state is stored as:

- `integrity: number` (0–100)
- `load: number`
- `history: { integrity: number[], load: number[] }` (sliding window)
- `events: Array<{ time: string, msg: string }>`

## Control Flow

### Node selection

1. User clicks a node on the canvas.
2. `NodeGraph` hit-tests the click and reports the clicked node.
3. `Dashboard` updates `selectedNodeId` and marks nodes as selected.
4. `LeftSidebar` Inspector renders `NodeDetails` for the selected node.

### Terminal commands

1. User submits a command line.
2. Input is tokenized into `command + args`.
3. A handler dispatches a simulated operation that updates:
   - logs
   - metrics
   - nodes

Supported commands include `help`, `clear`, `status`, `scan`, `purge`, and `ping`.

### Periodic metrics update

- A 1-second interval updates system metrics.
- A low-probability “anomaly” path may mark a node as infected and emit a system event.

## Interfaces

### Routing

- **Route**: `/dashboard`
- **Entry component**: `src/components/Dashboard/Dashboard.jsx`

### External dependencies

- React
- `lucide-react` icons

No network calls are required for baseline operation.

## State & Determinism Rules

- The dashboard uses randomization for node positions and anomaly selection.
- Logs use stable ids (monotonic sequence) to ensure stable React keys.

## Error Handling & Recovery

- Terminal tool operations use `try/catch` and return a readable error message to the output log when parsing fails.
- When a node id is missing/invalid for actions (e.g., `purge`, `ping`), a descriptive terminal error log is emitted.

## Testing Strategy

- Primary gate: `npm run ci` (markdown lint + eslint + typecheck + Vite build).
- Manual smoke:
  - Navigate to `/dashboard`.
  - Click nodes; verify Inspector updates.
  - Run terminal commands: `help`, `status`, `scan`, `ping`, `purge`.

## Operational Notes

- Runs entirely in the browser.
- Uses a canvas animation loop; keep the tab visible during testing.

## Changelog

- 2026-01-02: Integrated Studio Dashboard as the `/dashboard` view and refactored for repo lint/build gates.
