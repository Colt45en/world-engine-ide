import { backend } from '../platform/backend.js';
import type { MeshData } from '../platform/types.js';

export class BoxGeometry {
  public readonly vertices: Float32Array;
  public readonly normals: Float32Array;
  public readonly uvs: Float32Array;
  public readonly indices: Uint32Array;
  public readonly groups?: Array<{ start: number; count: number; materialIndex: number }>;

  constructor(width = 1, height = 1, depth = 1) {
    const mesh: MeshData = backend.makeBox(width, height, depth);
    this.vertices = mesh.vertices;
    this.normals = mesh.normals;
    this.uvs = mesh.uvs;
    this.indices = mesh.indices;
    this.groups = mesh.groups;
  }
}
