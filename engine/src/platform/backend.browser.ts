import type { GeometryBackend, MeshData } from './types.js';

/**
 * Expects a wasm loader at:
 *   engine/wasm/geometry_wasm.js
 * exporting:
 *   initWasm() -> Promise<{ makeBox(w,h,d): { vertices: Float32Array, indices: Uint32Array } }>
 */
export async function createBrowserBackend(): Promise<GeometryBackend> {
  const wasmMod = await import('../../wasm/geometry_wasm.js');
  const wasm = await wasmMod.initWasm();

  return {
    makeBox(w: number, h: number, d: number): MeshData {
      return wasm.makeBox(w, h, d);
    },
  };
}
