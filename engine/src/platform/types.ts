export type MeshData = {
  // Positions: xyz xyz ...
  vertices: Float32Array;
  // Face normals: xyz xyz ... (same cardinality as vertices)
  normals: Float32Array;
  // UVs: uv uv ... (2 floats per vertex)
  uvs: Float32Array;
  indices: Uint32Array;
  // Optional material groups (Three-style): 6 entries for an unsegmented box.
  groups?: Array<{ start: number; count: number; materialIndex: number }>;
};

export type GeometryBackend = {
  makeBox(w: number, h: number, d: number): MeshData;
};
