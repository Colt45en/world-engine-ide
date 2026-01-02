#pragma once
#include <cstdint>
#include <vector>

struct MeshDataCpp {
  std::vector<float> vertices;   // xyz xyz ...
  std::vector<float> normals;    // xyz xyz ...
  std::vector<float> uvs;        // uv uv ...
  std::vector<uint32_t> indices; // triangle indices
  struct Group {
    uint32_t start;
    uint32_t count;
    uint32_t materialIndex;
  };
  std::vector<Group> groups;
};

MeshDataCpp make_box(float w, float h, float d);
