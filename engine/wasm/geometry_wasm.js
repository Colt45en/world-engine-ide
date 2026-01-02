// Placeholder loader contract for the browser backend.
// Replace this with your Emscripten-generated ES module wrapper.

export async function initWasm() {
  throw new Error(
    'WASM backend not built yet. Build engine/wasm with Emscripten and replace engine/wasm/geometry_wasm.js with the generated loader (or an adapter that exports initWasm()).',
  );
}
