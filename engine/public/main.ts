import { BoxGeometry } from "../src/geometries/index.js";

const g = new BoxGeometry(1, 2, 3);
const el = document.getElementById("out");
if (el) {
  el.textContent =
    "BoxGeometry\n" +
    `vertices: ${g.vertices.length}\n` +
    `indices: ${g.indices.length}\n` +
    `first vertex: ${g.vertices[0]}, ${g.vertices[1]}, ${g.vertices[2]}\n`;
}
