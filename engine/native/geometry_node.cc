#include <node_api.h>
#include <cstring>

#include "geometry_lib.h"

static bool GetNumberArg(napi_env env, napi_value value, double* out) {
  napi_valuetype t;
  if (napi_typeof(env, value, &t) != napi_ok || t != napi_number) {
    return false;
  }
  return napi_get_value_double(env, value, out) == napi_ok;
}

static napi_value MakeBox(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value argv[3];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);

  if (argc != 3) {
    napi_throw_type_error(env, nullptr, "makeBox(w,h,d) expects 3 numbers");
    return nullptr;
  }

  double w, h, d;
  if (!GetNumberArg(env, argv[0], &w) || !GetNumberArg(env, argv[1], &h) ||
      !GetNumberArg(env, argv[2], &d)) {
    napi_throw_type_error(env, nullptr, "makeBox(w,h,d) expects 3 numbers");
    return nullptr;
  }

  MeshDataCpp mesh = make_box((float)w, (float)h, (float)d);

  // vertices
  napi_value v_ab;
  void* v_data = nullptr;
  const size_t v_bytes = mesh.vertices.size() * sizeof(float);
  if (napi_create_arraybuffer(env, v_bytes, &v_data, &v_ab) != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to allocate vertices ArrayBuffer");
    return nullptr;
  }
  std::memcpy(v_data, mesh.vertices.data(), v_bytes);

  napi_value v_ta;
  if (napi_create_typedarray(env, napi_float32_array, mesh.vertices.size(), v_ab, 0, &v_ta) != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to create Float32Array");
    return nullptr;
  }

  // indices
  napi_value i_ab;
  void* i_data = nullptr;
  const size_t i_bytes = mesh.indices.size() * sizeof(uint32_t);
  if (napi_create_arraybuffer(env, i_bytes, &i_data, &i_ab) != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to allocate indices ArrayBuffer");
    return nullptr;
  }
  std::memcpy(i_data, mesh.indices.data(), i_bytes);

  napi_value i_ta;
  if (napi_create_typedarray(env, napi_uint32_array, mesh.indices.size(), i_ab, 0, &i_ta) != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to create Uint32Array");
    return nullptr;
  }

  napi_value out;
  napi_create_object(env, &out);

  napi_set_named_property(env, out, "vertices", v_ta);
  // normals
  napi_value n_ab;
  void* n_data = nullptr;
  const size_t n_bytes = mesh.normals.size() * sizeof(float);
  if (napi_create_arraybuffer(env, n_bytes, &n_data, &n_ab) != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to allocate normals ArrayBuffer");
    return nullptr;
  }
  std::memcpy(n_data, mesh.normals.data(), n_bytes);

  napi_value n_ta;
  if (napi_create_typedarray(env, napi_float32_array, mesh.normals.size(), n_ab, 0, &n_ta) != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to create normals Float32Array");
    return nullptr;
  }
  napi_set_named_property(env, out, "normals", n_ta);

  // uvs
  napi_value uv_ab;
  void* uv_data = nullptr;
  const size_t uv_bytes = mesh.uvs.size() * sizeof(float);
  if (napi_create_arraybuffer(env, uv_bytes, &uv_data, &uv_ab) != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to allocate uvs ArrayBuffer");
    return nullptr;
  }
  std::memcpy(uv_data, mesh.uvs.data(), uv_bytes);

  napi_value uv_ta;
  if (napi_create_typedarray(env, napi_float32_array, mesh.uvs.size(), uv_ab, 0, &uv_ta) != napi_ok) {
    napi_throw_error(env, nullptr, "Failed to create uvs Float32Array");
    return nullptr;
  }
  napi_set_named_property(env, out, "uvs", uv_ta);

  napi_set_named_property(env, out, "indices", i_ta);

  // groups
  napi_value groups;
  if (napi_create_array_with_length(env, mesh.groups.size(), &groups) == napi_ok) {
    for (size_t gi = 0; gi < mesh.groups.size(); gi++) {
      napi_value g;
      napi_create_object(env, &g);

      napi_value start;
      napi_value count;
      napi_value materialIndex;
      napi_create_uint32(env, mesh.groups[gi].start, &start);
      napi_create_uint32(env, mesh.groups[gi].count, &count);
      napi_create_uint32(env, mesh.groups[gi].materialIndex, &materialIndex);

      napi_set_named_property(env, g, "start", start);
      napi_set_named_property(env, g, "count", count);
      napi_set_named_property(env, g, "materialIndex", materialIndex);

      napi_set_element(env, groups, gi, g);
    }
    napi_set_named_property(env, out, "groups", groups);
  }

  return out;
}

static napi_value Init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "makeBox", NAPI_AUTO_LENGTH, MakeBox, nullptr, &fn);
  napi_set_named_property(env, exports, "makeBox", fn);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
