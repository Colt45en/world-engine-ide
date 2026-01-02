import type { GeometryBackend } from './types.js';

let impl: GeometryBackend;

const isNode =
  typeof process !== 'undefined' &&
  (process as any).versions != null &&
  (process as any).versions.node != null;

if (isNode) {
  const mod = await import('./backend.node.js');
  impl = mod.backendNode;
} else {
  const mod = await import('./backend.browser.js');
  impl = await mod.createBrowserBackend();
}

export const backend: GeometryBackend = impl;
