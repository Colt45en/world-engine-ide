const fs = require('node:fs');
const path = process.argv[2];
if (!path) {
  console.error('Usage: node check_syntax.js <file>');
  process.exit(2);
}
const full = fs.readFileSync(path, 'utf8');
// Match all script blocks, pick the last (to avoid small module shims at top)
const all = [...full.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
if (!all.length) {
  console.error('No <script> block found');
  process.exit(2);
}
const script = all[all.length - 1][1];
try {
  // If script contains import/export at top-level, skip (module not supported by new Function)
  if (/\b(import|export)\b/.test(script)) {
    console.log('Skipping module script for syntax check (contains import/export)');
    process.exit(0);
  }
  new Function(script);
  console.log('Script syntax OK');
} catch (e) {
  console.error('SyntaxError:', e.message);
}
