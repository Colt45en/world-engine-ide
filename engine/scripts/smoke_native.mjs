/* eslint-env node */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

let addon;
try {
  addon = require('../native/build/Release/geometry.node');
} catch (e) {
  fail(
    'Failed to load native addon at engine/native/build/Release/geometry.node\n' +
      'Build it first with: cd engine && npm run native:build\n\n' +
      String(e && e.message ? e.message : e),
  );
}

if (!addon || typeof addon.makeBox !== 'function') {
  fail('Addon loaded but missing makeBox(w,h,d) export');
}

const mesh = addon.makeBox(1, 2, 3);
if (!mesh || !mesh.vertices || !mesh.indices) {
  fail('makeBox returned invalid mesh');
}

console.log('native addon: OK');
console.log('vertices:', mesh.vertices.length, '(floats)');
console.log('normals:', mesh.normals ? mesh.normals.length : '(missing)');
console.log('uvs:', mesh.uvs ? mesh.uvs.length : '(missing)');
console.log('indices:', mesh.indices.length, '(uint32)');
console.log('groups:', Array.isArray(mesh.groups) ? mesh.groups.length : '(missing)');
console.log('first vertex:', mesh.vertices[0], mesh.vertices[1], mesh.vertices[2]);
