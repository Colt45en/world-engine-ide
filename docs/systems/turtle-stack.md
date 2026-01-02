# Turtle Stack (Language DOM Trees)

## Purpose / Scope

The Turtle Stack is a UI tool for visualizing a multi-layer “language stack”:

- **Layer 1 (Johnson/JSON)**: canonical state
- **Layer 2 (HTML)**: structure derived from state (including a pseudo-HTML rendering of a tree)
- **Layer 3 (CSS)**: presentation hints
- **Layer 4 (JS)**: behavior hints
- **Composite**: the rendered output

In this repo it is used to turn **webhint-derived file inventories** into a deterministic **Language DOM Tree (LDOM)** that can be embedded into the Johnson layer and rendered as pseudo-HTML.

## Architecture

Components:

- UI entrypoint: [src/components/TurtleStack/TurtleStack.jsx](../../src/components/TurtleStack/TurtleStack.jsx)
- Route: [src/pages/TurtleStackPage.jsx](../../src/pages/TurtleStackPage.jsx)
- Tree IR helpers: [src/core/lang/language-dom-tree.js](../../src/core/lang/language-dom-tree.js)
- Engine system: [src/core/lang/language-dom-tree-system.js](../../src/core/lang/language-dom-tree-system.js)

Boundaries:

- The **LDOM helpers** are pure functions (deterministic transforms).
- The **engine system** optionally loads a feed and emits bus events.
- The **UI** may load `public/webhint-feed.json` directly (dev convenience) and embed the resulting LDOM into JSON.

### Performance Optimizations

The LDOM system includes several performance features for handling large trees:

- **Lazy building**: Uses `requestIdleCallback` to build trees incrementally without blocking the main thread
- **Virtual rendering**: Renders only visible portions of the tree using `startLine` option
- **Collapsible nodes**: Supports collapsing directory nodes to reduce rendered content
- **Indent caching**: Pre-computes indent strings to minimize string allocations
- **Batch processing**: Processes entries in configurable batches (default 100 entries per batch)

## Data Model / IR

### Webhint feed

Source is a JSON file produced by `scripts/webhint/buildTree.js`:

- `generatedAt: number`
- `root: string`
- `entries: Array<{ path: string, lang: string, size: number, firstLines: string, mtimeMs: number }>`

### Language DOM Tree (LDOM)

LDOM is a filesystem-like tree based on `entries[].path` segments:

- `dir` node: `{ name, type: 'dir', children: LanguageDomTreeNode[] }`
- `file` node: `{ name, type: 'file', lang?, size? }`

Invariants:

- Children ordering is deterministic: dirs first, then files, then lexicographic by name.
- Tree depth is bounded (`maxDepth`) to prevent runaway size.

## Control Flow

### UI-driven (TurtleStack)

1. TurtleStack starts with a default Johnson JSON.
2. If `webhint.feedUrl` exists and the JSON is still at its initial value, it emits `WEBHINT/LOAD_FEED` on the shared bus.
3. `LanguageDomTreeSystem` loads the feed, filters to `hint-report/` entries by default, builds LDOM, and emits `WEBHINT/LDOM_UPDATED`.
4. TurtleStack hydrates the Johnson JSON with `languageDomTree` and webhint status fields.
5. The HTML layer renders `languageDomTree` as pseudo-HTML in a `<pre>`.

Manual reload:

- TurtleStack includes a **Reload feed** button.
- Clicking it re-emits `WEBHINT/LOAD_FEED` and will hydrate the JSON even if it has been edited (explicit user action).

### Engine-driven

1. A caller emits `{ channel:'WEBHINT', type:'LOAD_FEED', payload:{ url } }`.
2. `LanguageDomTreeSystem` loads the feed, builds LDOM, then emits:
   - `WEBHINT/LDOM_UPDATED` on success
   - `WEBHINT/LDOM_ERROR` on failure

## Interfaces

### Routes

- `/studio/turtle-stack`

### Bus events

- Request: `WEBHINT/LOAD_FEED` with `{ url, hintReportOnly?: boolean }`
- Success: `WEBHINT/LDOM_UPDATED` with `{ url, tree, counts, generatedAt }`
- Failure: `WEBHINT/LDOM_ERROR` with `{ url, error }`

## State & Determinism Rules

- LDOM builders MUST be deterministic for the same input `entries[]`.
- UI auto-hydration MUST NOT overwrite user-edited JSON; it only hydrates when the JSON equals the initial default.

## Error Handling & Recovery

- If the feed cannot be fetched/parsed, TurtleStack sets `webhint.status = 'error'` and records `webhint.error` in JSON.
- The engine system emits `WEBHINT/LDOM_ERROR` instead of throwing.

## Testing Strategy

- JS unit tests are not currently established for UI tools.
- Verification strategy:
  - Run `npm run webhint:feed:public`.
  - Run `npm run dev` and open `/studio/turtle-stack`.
  - Confirm Layer 2 shows a pseudo-HTML tree when `languageDomTree` is present.

## Operational Notes

### Engine initialization

The engine is initialized once at app startup so its systems (including `LanguageDomTreeSystem`) can service bus requests.

### Generate the feed

The UI expects the feed at `public/webhint-feed.json`:

- `npm run webhint:feed:public`

This produces a repo-wide file inventory (including `hint-report/` unless excluded).

### Performance API Usage

For optimal performance with large datasets:

**Lazy tree building** (automatic for >500 entries):
```javascript
const tree = await buildLanguageDomTree(entries, {
  maxDepth: 7,
  lazy: true,
  batchSize: 100
});
```

**Virtual rendering** (render only visible lines):
```javascript
const visibleLines = languageDomTreeToPseudoHtmlLines(tree, {
  maxLines: 50,
  startLine: 100,  // Skip first 100 lines
  collapsed: new Set(['root/node_modules'])  // Collapse specific paths
});
```

**Incremental rendering** (for streaming):
```javascript
const renderer = languageDomTreeLazyRenderer(tree, { chunkSize: 50 });
for (const chunk of renderer) {
  // Process each chunk of lines
  displayLines(chunk);
}
```

## Changelog

- 2026-01-02: Added performance optimizations for large tree rendering:
  - Lazy tree building using requestIdleCallback
  - Virtual rendering with startLine/maxLines options
  - Collapsible node support
  - Indent caching for reduced memory allocations
  - Lazy renderer generator for streaming
  - Automatic lazy mode for datasets >500 entries
- 2026-01-01: Added TurtleStack UI, LDOM helpers, and optional engine system integration.
- 2026-01-01: Switched TurtleStack feed loading to bus-driven (WEBHINT events).
