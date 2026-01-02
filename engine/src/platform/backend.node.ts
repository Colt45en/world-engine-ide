import { createRequire } from 'node:module';
import type { GeometryBackend, MeshData } from './types.js';

const require = createRequire(import.meta.url);

// Built by: `npm run native:build` (from engine/)
// Output: engine/native/build/Release/geometry.node
// eslint-disable-next-line @typescript-eslint/no-var-requires
const native = require('../../native/build/Release/geometry.node') as {
  makeBox(w: number, h: number, d: number): MeshData;
};

export const backendNode: GeometryBackend = {
  makeBox(w: number, h: number, d: number): MeshData {
    return native.makeBox(w, h, d);
  },
};
