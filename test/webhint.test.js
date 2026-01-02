const fs = require('node:fs');
const path = require('node:path');
const { buildTree } = require('../scripts/webhint/buildTree');

describe('webhint feed builder', () => {
  test('builds a feed and writes entries', () => {
    const out = path.join(process.cwd(), 'build', 'webhint-feed.test.json');
    const res = buildTree({ root: process.cwd(), out });
    expect(res).toBeDefined();
    expect(res.entries).toBeInstanceOf(Array);
    expect(fs.existsSync(out)).toBe(true);
    const p = JSON.parse(fs.readFileSync(out, 'utf8'));
    expect(p.generatedAt).toBeGreaterThan(0);
    // cleanup
    fs.unlinkSync(out);
  });
});
