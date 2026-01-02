/**
 * Language DOM Tree (LDOM)
 *
 * Purpose: represent a filesystem/asset set (e.g., webhint feed entries) as a deterministic tree.
 * This is intentionally not an HTML DOM; it is a language-layer tree that can be rendered
 * as pseudo-HTML (Layer 2) or embedded into Johnson/JSON (Layer 1).
 *
 * Performance features:
 * - Lazy building: Use `lazy: true` option to build tree incrementally using requestIdleCallback
 * - Virtual rendering: Use `startLine` option to render only visible portion of tree
 * - Collapsible nodes: Use `collapsed` Set to hide/show directory contents
 * - Indent caching: Pre-compute indent strings to reduce string allocations
 */

/**
 * @typedef {{ path: string, lang?: string, size?: number }} WebhintEntry
 * @typedef {{ name: string, type: 'dir', children: LanguageDomTreeNode[] } | { name: string, type: 'file', lang?: string, size?: number }} LanguageDomTreeNode
 */

/**
 * Performance helper: measure tree building time
 * @param {string} label
 * @param {Function} fn
 * @returns {*}
 */
export function measurePerformance(label, fn) {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') {
    return fn();
  }

  const startMark = `${label}-start`;
  const endMark = `${label}-end`;
  const measureName = label;

  performance.mark(startMark);
  const result = fn();

  if (result instanceof Promise) {
    return result.then((value) => {
      performance.mark(endMark);
      performance.measure(measureName, startMark, endMark);
      return value;
    });
  }

  performance.mark(endMark);
  performance.measure(measureName, startMark, endMark);
  return result;
}

/**
 * Build a deterministic tree from `entries[].path` using `/` separators.
 *
 * @param {WebhintEntry[]} entries
 * @param {{ maxDepth?: number, lazy?: boolean, batchSize?: number }} [opts]
 * @returns {LanguageDomTreeNode | Promise<LanguageDomTreeNode>}
 */
export function buildLanguageDomTree(entries, opts = {}) {
  const maxDepth = typeof opts.maxDepth === 'number' ? opts.maxDepth : 6;
  const lazy = opts.lazy === true;
  const batchSize = typeof opts.batchSize === 'number' ? opts.batchSize : 100;

  const root = { name: 'root', type: 'dir', children: new Map() };

  // Lazy building: process in batches using requestIdleCallback or setTimeout
  if (lazy && typeof globalThis.requestIdleCallback === 'function') {
    return buildTreeLazy(entries, root, maxDepth, batchSize);
  }

  // Synchronous building (default)
  for (const e of entries || []) {
    const parts = String(e.path || '')
      .split('/')
      .filter(Boolean);
    if (!parts.length) continue;

    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLeaf = i === parts.length - 1;
      const depth = i + 1;

      if (depth > maxDepth) break;

      if (!node.children.has(part)) {
        node.children.set(
          part,
          isLeaf
            ? { name: part, type: 'file', lang: e.lang, size: e.size }
            : { name: part, type: 'dir', children: new Map() },
        );
      }

      const next = node.children.get(part);
      if (!next || next.type !== 'dir') break;
      node = next;
    }
  }

  return toPlainTree(root);
}

/**
 * Build tree lazily using requestIdleCallback for better performance
 * @private
 */
function buildTreeLazy(entries, root, maxDepth, batchSize) {
  return new Promise((resolve) => {
    let index = 0;
    const entriesArray = entries || [];

    function processBatch(deadline) {
      while (index < entriesArray.length && (deadline.timeRemaining() > 0 || deadline.didTimeout)) {
        const batchEnd = Math.min(index + batchSize, entriesArray.length);

        for (; index < batchEnd; index++) {
          const e = entriesArray[index];
          const parts = String(e.path || '')
            .split('/')
            .filter(Boolean);
          if (!parts.length) continue;

          let node = root;
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isLeaf = i === parts.length - 1;
            const depth = i + 1;

            if (depth > maxDepth) break;

            if (!node.children.has(part)) {
              node.children.set(
                part,
                isLeaf
                  ? { name: part, type: 'file', lang: e.lang, size: e.size }
                  : { name: part, type: 'dir', children: new Map() },
              );
            }

            const next = node.children.get(part);
            if (!next || next.type !== 'dir') break;
            node = next;
          }
        }

        if (index >= entriesArray.length) {
          resolve(toPlainTree(root));
          return;
        }
      }

      globalThis.requestIdleCallback(processBatch);
    }

    globalThis.requestIdleCallback(processBatch);
  });
}

/**
 * Convert Map-based tree to plain array tree (memoization-friendly)
 * @private
 */
function toPlainTree(n) {
  if (n.type === 'file') return { name: n.name, type: 'file', lang: n.lang, size: n.size };

  const children = Array.from(n.children.values())
    .map(toPlainTree)
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return { name: n.name, type: 'dir', children };
}

/**
 * Render a Language DOM Tree as pseudo-HTML lines (safe for a <pre/> text view).
 *
 * @param {LanguageDomTreeNode} tree
 * @param {{ maxLines?: number, startLine?: number, collapsed?: Set<string> }} [opts]
 * @returns {string[]}
 */
export function languageDomTreeToPseudoHtmlLines(tree, opts = {}) {
  const maxLines = typeof opts.maxLines === 'number' ? opts.maxLines : 160;
  const startLine = typeof opts.startLine === 'number' ? opts.startLine : 0;
  const collapsed = opts.collapsed || new Set();
  const lines = [];

  // Pre-allocate indent strings for better performance
  const indentCache = new Map();
  function getIndent(level) {
    if (!indentCache.has(level)) {
      indentCache.set(level, ' '.repeat(level));
    }
    return indentCache.get(level);
  }

  let lineCount = 0;

  function walk(node, indent, path = '') {
    if (node.type === 'dir') {
      const isCollapsed = collapsed.has(path);

      // Count and possibly skip opening tag
      if (lineCount >= startLine && lines.length < maxLines) {
        const attrs = isCollapsed ? ' collapsed="true"' : '';
        lines.push(`${getIndent(indent)}<dir name="${node.name}"${attrs}>`);
      }
      lineCount++;

      // Process children if not collapsed
      if (!isCollapsed) {
        for (const child of node.children || []) {
          const childPath = path ? `${path}/${child.name}` : child.name;
          walk(child, indent + 2, childPath);
        }

        // Count and possibly render closing tag
        if (lineCount >= startLine && lines.length < maxLines) {
          lines.push(`${getIndent(indent)}</dir>`);
        }
        lineCount++;
      }
      return;
    }

    // File node
    if (lineCount >= startLine && lines.length < maxLines) {
      lines.push(`${getIndent(indent)}<file name="${node.name}" lang="${node.lang || 'unknown'}" />`);
    }
    lineCount++;
  }

  walk(tree, 0);

  if (lines.length >= maxLines) lines.push('[truncated]');

  return lines;
}

/**
 * Create a lazy renderer that builds lines on-demand for large trees
 * @param {LanguageDomTreeNode} tree
 * @param {{ chunkSize?: number }} [opts]
 * @returns {Generator<string[], void, unknown>}
 */
export function* languageDomTreeLazyRenderer(tree, opts = {}) {
  const chunkSize = typeof opts.chunkSize === 'number' ? opts.chunkSize : 50;
  const lines = [];

  // Pre-allocate indent strings
  const indentCache = new Map();
  function getIndent(level) {
    if (!indentCache.has(level)) {
      indentCache.set(level, ' '.repeat(level));
    }
    return indentCache.get(level);
  }

  function* walk(node, indent) {
    if (node.type === 'dir') {
      lines.push(`${getIndent(indent)}<dir name="${node.name}">`);

      if (lines.length >= chunkSize) {
        yield lines.splice(0, lines.length);
      }

      for (const child of node.children || []) {
        yield* walk(child, indent + 2);
      }

      lines.push(`${getIndent(indent)}</dir>`);

      if (lines.length >= chunkSize) {
        yield lines.splice(0, lines.length);
      }
      return;
    }

    lines.push(`${getIndent(indent)}<file name="${node.name}" lang="${node.lang || 'unknown'}" />`);

    if (lines.length >= chunkSize) {
      yield lines.splice(0, lines.length);
    }
  }

  yield* walk(tree, 0);

  if (lines.length > 0) {
    yield lines;
  }
}
