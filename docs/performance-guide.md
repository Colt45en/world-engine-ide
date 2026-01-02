# Performance Guide

## Language DOM Tree Performance

### Overview

The Language DOM Tree (LDOM) system includes several performance optimizations for handling large code visualization tasks without blocking the UI.

### Key Performance Features

#### 1. Lazy Tree Building

For large datasets (>500 entries), the system automatically uses `requestIdleCallback` to build the tree incrementally:

```javascript
// Automatic lazy mode for large datasets
const tree = await buildLanguageDomTree(largeEntryList, {
  maxDepth: 7,
  lazy: true, // Enable lazy building
  batchSize: 100, // Process 100 entries per idle callback
});
```

**Benefits:**

- Non-blocking: UI remains responsive during tree construction
- Better perceived performance for large codebases
- Automatic batching with configurable batch size

#### 2. Virtual Rendering

Only render the visible portion of large trees:

```javascript
const visibleLines = languageDomTreeToPseudoHtmlLines(tree, {
  maxLines: 50, // Render up to 50 lines
  startLine: 100, // Start from line 100 (for scrolling)
});
```

**Benefits:**

- Constant-time rendering regardless of tree size
- Efficient memory usage
- Smooth scrolling for large trees

#### 3. Collapsible Nodes

Reduce rendered content by collapsing directory nodes:

```javascript
const collapsed = new Set(['root/node_modules', 'root/dist']);
const lines = languageDomTreeToPseudoHtmlLines(tree, {
  maxLines: 200,
  collapsed: collapsed,
});
```

**Benefits:**

- User-controlled detail level
- Faster rendering when directories are collapsed
- Better focus on relevant code

#### 4. Indent Caching

The rendering system pre-computes and caches indent strings:

```javascript
// Automatically used internally
const indentCache = new Map();
function getIndent(level) {
  if (!indentCache.has(level)) {
    indentCache.set(level, ' '.repeat(level));
  }
  return indentCache.get(level);
}
```

**Benefits:**

- Reduces string allocations
- Faster repeated renders
- Lower memory pressure

#### 5. Streaming Rendering

For very large trees, use the lazy renderer generator:

```javascript
const renderer = languageDomTreeLazyRenderer(tree, { chunkSize: 50 });

for (const chunk of renderer) {
  // Process each chunk as it becomes available
  appendToDisplay(chunk);

  // Allow UI updates between chunks
  await new Promise((resolve) => setTimeout(resolve, 0));
}
```

**Benefits:**

- Progressive rendering
- Memory efficient for huge trees
- Can be cancelled mid-stream

### Performance Recommendations

#### For Small Trees (<100 entries)

- Use synchronous building (default)
- No special options needed

```javascript
const tree = buildLanguageDomTree(entries);
const lines = languageDomTreeToPseudoHtmlLines(tree);
```

#### For Medium Trees (100-1000 entries)

- Consider lazy building for better perceived performance
- Use maxLines to limit initial render

```javascript
const tree = await buildLanguageDomTree(entries, { lazy: true });
const lines = languageDomTreeToPseudoHtmlLines(tree, { maxLines: 200 });
```

#### For Large Trees (>1000 entries)

- Always use lazy building
- Implement virtual scrolling with startLine
- Use collapsible directories

```javascript
const tree = await buildLanguageDomTree(entries, {
  lazy: true,
  batchSize: 100,
});

// Render visible window
const visibleLines = languageDomTreeToPseudoHtmlLines(tree, {
  maxLines: 50,
  startLine: scrollPosition,
  collapsed: collapsedDirs,
});
```

#### For Huge Trees (>10000 entries)

- Use streaming renderer
- Limit tree depth
- Consider server-side filtering

```javascript
const tree = await buildLanguageDomTree(entries, {
  lazy: true,
  maxDepth: 5, // Limit depth to reduce size
});

const renderer = languageDomTreeLazyRenderer(tree, { chunkSize: 25 });
// Stream chunks to display
```

### Performance Monitoring

Use the built-in performance measurement:

```javascript
import { measurePerformance } from './src/core/lang/language-dom-tree.js';

const tree = measurePerformance('tree-build', () => {
  return buildLanguageDomTree(entries);
});

// Check browser performance timeline
performance.getEntriesByName('tree-build').forEach((entry) => {
  console.log(`Duration: ${entry.duration}ms`);
});
```

### Browser Compatibility

- **Lazy building**: Requires `requestIdleCallback` (all modern browsers)
- **Fallback**: System automatically falls back to synchronous mode if unavailable
- **Performance API**: Optional, gracefully degrades if not available

### Best Practices

1. **Profile first**: Use browser DevTools to identify actual bottlenecks
2. **Batch updates**: Don't rebuild tree on every keystroke
3. **Cache results**: Reuse trees when data hasn't changed
4. **Limit depth**: Use `maxDepth` to prevent runaway tree sizes
5. **Filter data**: Pre-filter entries before tree building when possible

### Example: Optimized TurtleStack Integration

```javascript
import {
  buildLanguageDomTree,
  languageDomTreeToPseudoHtmlLines,
} from './core/lang/language-dom-tree.js';

// In a React component
const [tree, setTree] = useState(null);
const [collapsedDirs, setCollapsedDirs] = useState(new Set());

useEffect(() => {
  async function loadTree() {
    const entries = await fetchEntries();

    // Auto-lazy for large datasets
    const shouldUseLazy = entries.length > 500;
    const newTree = await buildLanguageDomTree(entries, {
      maxDepth: 7,
      lazy: shouldUseLazy,
      batchSize: 100,
    });

    setTree(newTree);
  }

  loadTree();
}, [url]);

// Render with virtual scrolling
const visibleLines = useMemo(() => {
  if (!tree) return [];

  return languageDomTreeToPseudoHtmlLines(tree, {
    maxLines: 50,
    startLine: scrollTop,
    collapsed: collapsedDirs,
  });
}, [tree, scrollTop, collapsedDirs]);
```

## See Also

- [Turtle Stack System Documentation](./systems/turtle-stack.md)
- [Frontend UI Documentation](./systems/frontend-ui.md)
