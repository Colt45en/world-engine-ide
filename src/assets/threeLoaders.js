import * as THREE from 'three';

/** @type {Promise<any> | null} */
let gltfLoaderPromise = null;

async function getGltfLoader() {
  if (!gltfLoaderPromise) {
    gltfLoaderPromise = import('three/examples/jsm/loaders/GLTFLoader.js').then(
      (m) => new m.GLTFLoader(),
    );
  }
  return gltfLoaderPromise;
}

const texLoader = new THREE.TextureLoader();
const audioLoader = new THREE.AudioLoader();

export const threeLoaders = {
  models: async (path, onProgress) => {
    const gltfLoader = await getGltfLoader();
    return new Promise((resolve, reject) => {
      gltfLoader.load(
        path,
        (gltf) => resolve(gltf),
        (evt) => {
          if (!evt || !evt.total) return;
          if (typeof onProgress === 'function') onProgress(evt.loaded / evt.total);
        },
        (err) => reject(err),
      );
    });
  },

  textures: (path, onProgress) =>
    new Promise((resolve, reject) => {
      texLoader.load(
        path,
        (t) => resolve(t),
        (evt) => {
          if (!evt || !evt.total) return;
          if (typeof onProgress === 'function') onProgress(evt.loaded / evt.total);
        },
        (err) => reject(err),
      );
    }),

  audio: (path, onProgress) =>
    new Promise((resolve, reject) => {
      audioLoader.load(
        path,
        (buf) => resolve(buf),
        (evt) => {
          if (!evt || !evt.total) return;
          if (typeof onProgress === 'function') onProgress(evt.loaded / evt.total);
        },
        (err) => reject(err),
      );
    }),

  config: async (path) => {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`fetch failed ${r.status} for ${path}`);
    return r.json();
  },

  shaders: async (path) => {
    const r = await fetch(path);
    if (!r.ok) throw new Error(`fetch failed ${r.status} for ${path}`);
    return r.text();
  },
};
