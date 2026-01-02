#include "geometry_lib.h"

static void build_plane(
    int u,
    int v,
    int w,
    float udir,
    float vdir,
    float width,
    float height,
    float depth,
    int gridX,
    int gridY,
    uint32_t materialIndex,
    MeshDataCpp& out,
    uint32_t& numberOfVertices,
    uint32_t& groupStart) {
  const float segmentWidth = width / (float)gridX;
  const float segmentHeight = height / (float)gridY;

  const float widthHalf = width / 2.0f;
  const float heightHalf = height / 2.0f;
  const float depthHalf = depth / 2.0f;

  const uint32_t gridX1 = (uint32_t)(gridX + 1);
  const uint32_t gridY1 = (uint32_t)(gridY + 1);

  uint32_t vertexCounter = 0;
  uint32_t groupCount = 0;

  float vec[3] = {0, 0, 0};

  // vertices, normals, uvs
  for (uint32_t iy = 0; iy < gridY1; iy++) {
    const float y = (float)iy * segmentHeight - heightHalf;
    for (uint32_t ix = 0; ix < gridX1; ix++) {
      const float x = (float)ix * segmentWidth - widthHalf;

      vec[u] = x * udir;
      vec[v] = y * vdir;
      vec[w] = depthHalf;
      out.vertices.push_back(vec[0]);
      out.vertices.push_back(vec[1]);
      out.vertices.push_back(vec[2]);

      vec[u] = 0;
      vec[v] = 0;
      vec[w] = depth > 0 ? 1.0f : -1.0f;
      out.normals.push_back(vec[0]);
      out.normals.push_back(vec[1]);
      out.normals.push_back(vec[2]);

      out.uvs.push_back((float)ix / (float)gridX);
      out.uvs.push_back(1.0f - ((float)iy / (float)gridY));

      vertexCounter += 1;
    }
  }

  // indices
  for (uint32_t iy = 0; iy < (uint32_t)gridY; iy++) {
    for (uint32_t ix = 0; ix < (uint32_t)gridX; ix++) {
      const uint32_t a = numberOfVertices + ix + gridX1 * iy;
      const uint32_t b = numberOfVertices + ix + gridX1 * (iy + 1);
      const uint32_t c = numberOfVertices + (ix + 1) + gridX1 * (iy + 1);
      const uint32_t d = numberOfVertices + (ix + 1) + gridX1 * iy;

      out.indices.push_back(a);
      out.indices.push_back(b);
      out.indices.push_back(d);
      out.indices.push_back(b);
      out.indices.push_back(c);
      out.indices.push_back(d);

      groupCount += 6;
    }
  }

  MeshDataCpp::Group g;
  g.start = groupStart;
  g.count = groupCount;
  g.materialIndex = materialIndex;
  out.groups.push_back(g);

  groupStart += groupCount;
  numberOfVertices += vertexCounter;
}

MeshDataCpp make_box(float w, float h, float d) {
  MeshDataCpp out;

  // True parity target for the non-segmented box: 24 vertices, 36 indices, per-face normals/uvs/groups.
  const int widthSegments = 1;
  const int heightSegments = 1;
  const int depthSegments = 1;

  uint32_t numberOfVertices = 0;
  uint32_t groupStart = 0;

  // Mirror Three's build order.
  // px
  build_plane(2, 1, 0, -1.0f, -1.0f, d, h, w, depthSegments, heightSegments, 0, out, numberOfVertices, groupStart);
  // nx
  build_plane(2, 1, 0,  1.0f, -1.0f, d, h, -w, depthSegments, heightSegments, 1, out, numberOfVertices, groupStart);
  // py
  build_plane(0, 2, 1,  1.0f,  1.0f, w, d, h, widthSegments, depthSegments, 2, out, numberOfVertices, groupStart);
  // ny
  build_plane(0, 2, 1,  1.0f, -1.0f, w, d, -h, widthSegments, depthSegments, 3, out, numberOfVertices, groupStart);
  // pz
  build_plane(0, 1, 2,  1.0f, -1.0f, w, h, d, widthSegments, heightSegments, 4, out, numberOfVertices, groupStart);
  // nz
  build_plane(0, 1, 2, -1.0f, -1.0f, w, h, -d, widthSegments, heightSegments, 5, out, numberOfVertices, groupStart);

  return out;
}
