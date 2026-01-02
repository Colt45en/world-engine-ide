// eslint-disable-next-line no-unused-vars
import { cellKey, FACES } from '../grid/grid';

/**
 * Anchor record: deterministic placement.
 *
 * @typedef {'tile'|'tree'|'prop'} Kind
 * @typedef {{kind:Kind, cell:[number,number,number], face:keyof typeof FACES, yaw:number, createdAtMs:number}} Anchor
 */

export class Occupancy {
  constructor() {
    /** @type {Map<string, Anchor>} */
    this.byAnchor = new Map();
  }

  /** @param {[number,number,number]} cell @param {keyof typeof FACES} face */
  has(cell, face) {
    return this.byAnchor.has(`${cellKey(cell)}|${face}`);
  }

  /** @param {Anchor} anchor */
  set(anchor) {
    this.byAnchor.set(`${cellKey(anchor.cell)}|${anchor.face}`, anchor);
  }

  /** @param {[number,number,number]} cell @param {keyof typeof FACES} face */
  get(cell, face) {
    return this.byAnchor.get(`${cellKey(cell)}|${face}`) || null;
  }

  /** @param {[number,number,number]} cell @param {keyof typeof FACES} face */
  remove(cell, face) {
    this.byAnchor.delete(`${cellKey(cell)}|${face}`);
  }

  /** @returns {Anchor[]} */
  all() {
    return Array.from(this.byAnchor.values());
  }
}
