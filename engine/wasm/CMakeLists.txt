cmake_minimum_required(VERSION 3.18)
project(geometry_wasm)

set(CMAKE_CXX_STANDARD 17)

add_library(geometry_lib STATIC ../native/geometry_lib.cpp)
target_include_directories(geometry_lib PUBLIC ../native)

# geometry_wasm is an Emscripten/embind target; it must be built with the
# Emscripten toolchain (EMSCRIPTEN=ON). Building it with MSVC/Clang-cl will fail
# because <emscripten/bind.h> is not available.
if (EMSCRIPTEN)
  add_executable(geometry_wasm geometry_wasm.cpp)
  target_include_directories(geometry_wasm PRIVATE ../native)
  target_link_libraries(geometry_wasm PRIVATE geometry_lib)

  set_target_properties(geometry_wasm PROPERTIES
    LINK_FLAGS "-sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web -sALLOW_MEMORY_GROWTH=1 --bind"
  )
else()
  message(STATUS "Skipping geometry_wasm (requires Emscripten toolchain)")
endif()
