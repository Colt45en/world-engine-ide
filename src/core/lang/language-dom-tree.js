/**
 * Language DOM Tree (LDOM)
 *
 * Purpose: represent a filesystem/asset set (e.g., webhint feed entries) as a deterministic tree.
 * This is intentionally not an HTML DOM; it is a language-layer tree that can be rendered
 * as pseudo-HTML (Layer 2) or embedded into Johnson/JSON (Layer 1).
 */

/**
 * @typedef {{ path: string, lang?: string, size?: number }} WebhintEntry
 * @typedef {{ name: string, type: 'dir', children: LanguageDomTreeNode[] } | { name: string, type: 'file', lang?: string, size?: number }} LanguageDomTreeNode
 */

/**
 * Build a deterministic tree from `entries[].path` using `/` separators.
 *
 * @param {WebhintEntry[]} entries
 * @param {{ maxDepth?: number }} [opts]
 * @returns {LanguageDomTreeNode}
 */
export function buildLanguageDomTree(entries, opts = {}) {
  const maxDepth = typeof opts.maxDepth === 'number' ? opts.maxDepth : 6;

  const root = { name: 'root', type: 'dir', children: new Map() };

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

  function toPlain(n) {
    if (n.type === 'file') return { name: n.name, type: 'file', lang: n.lang, size: n.size };

    const children = Array.from(n.children.values())
      .map(toPlain)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return { name: n.name, type: 'dir', children };
  }

  return toPlain(root);
}

/**
 * Render a Language DOM Tree as pseudo-HTML lines (safe for a <pre/> text view).
 *
 * @param {LanguageDomTreeNode} tree
 * @param {{ maxLines?: number }} [opts]
 * @returns {string[]}
 */
export function languageDomTreeToPseudoHtmlLines(tree, opts = {}) {
  const maxLines = typeof opts.maxLines === 'number' ? opts.maxLines : 160;
  const lines = [];

  function walk(node, indent) {
    if (lines.length >= maxLines) return;

    if (node.type === 'dir') {
      lines.push(`${' '.repeat(indent)}<dir name="${node.name}">`);
      for (const child of node.children || []) walk(child, indent + 2);
      lines.push(`${' '.repeat(indent)}</dir>`);
      return;
    }

    lines.push(
      `${' '.repeat(indent)}<file name="${node.name}" lang="${node.lang || 'unknown'}" />`,
    );
  }

  walk(tree, 0);

  if (lines.length >= maxLines) lines.push('[truncated]');

  return lines;
}
