#!/usr/bin/env node
const { buildTree } = require('./buildTree');
const { runHints } = require('./runHints');
const path = require('path');

const cmd = process.argv[2] || 'build';
if (cmd === 'build') {
  buildTree({ root: process.cwd(), out: path.join(process.cwd(), 'build', 'webhint-feed.json') });
} else if (cmd === 'run') {
  const ok = runHints({
    root: process.cwd(),
    feed: path.join(process.cwd(), 'build', 'webhint-feed.json'),
  });
  process.exit(ok ? 0 : 2);
} else if (cmd === 'all') {
  buildTree({ root: process.cwd(), out: path.join(process.cwd(), 'build', 'webhint-feed.json') });
  const ok = runHints({
    root: process.cwd(),
    feed: path.join(process.cwd(), 'build', 'webhint-feed.json'),
  });
  process.exit(ok ? 0 : 2);
} else {
  console.log('Usage: index.js [build|run|all]');
  process.exit(2);
}
