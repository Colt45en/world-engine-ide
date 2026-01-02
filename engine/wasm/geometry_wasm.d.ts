export type WasmGeometryModule = {
  makeBox(
    w: number,
    h: number,
    d: number,
  ): {
    vertices: Float32Array;
    normals: Float32Array;
    uvs: Float32Array;
    indices: Uint32Array;
    groups: Array<{ start: number; count: number; materialIndex: number }>;
  };
};

export function initWasm(): Promise<WasmGeometryModule>;
