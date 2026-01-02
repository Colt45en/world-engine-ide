#include <emscripten/bind.h>
#include "../native/geometry_lib.h"

using namespace emscripten;

val makeBox(float w, float h, float d) {
  MeshDataCpp mesh = make_box(w, h, d);

  val vertices = val::global("Float32Array").new_(
      typed_memory_view(mesh.vertices.size(), mesh.vertices.data()));
  val normals = val::global("Float32Array").new_(
      typed_memory_view(mesh.normals.size(), mesh.normals.data()));
  val uvs = val::global("Float32Array").new_(
      typed_memory_view(mesh.uvs.size(), mesh.uvs.data()));
  val indices = val::global("Uint32Array").new_(
      typed_memory_view(mesh.indices.size(), mesh.indices.data()));

  val out = val::object();
  out.set("vertices", vertices);
  out.set("normals", normals);
  out.set("uvs", uvs);
  out.set("indices", indices);

  val groups = val::array();
  for (size_t i = 0; i < mesh.groups.size(); i++) {
    val g = val::object();
    g.set("start", mesh.groups[i].start);
    g.set("count", mesh.groups[i].count);
    g.set("materialIndex", mesh.groups[i].materialIndex);
    groups.set(i, g);
  }
  out.set("groups", groups);

  return out;
}

EMSCRIPTEN_BINDINGS(geometry_wasm) {
  function("makeBox", &makeBox);
}
