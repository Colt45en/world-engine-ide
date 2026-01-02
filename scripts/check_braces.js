const fs = require('node:fs');
const path = process.argv[2];
if (!path) {
  console.error('Usage: node check_braces.js <file>');
  process.exit(2);
}
const full = fs.readFileSync(path, 'utf8');
// Extract first <script>...</script> block
const m = full.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
if (!m) {
  console.error('No <script> block found');
  process.exit(2);
}
const text = m[1];
let stack = 0;
let lineNum = 1;
const lines = text.split(/\r?\n/);
let issues = [];
let minStack = Infinity;
let minLine = -1;
for (const line of lines) {
  for (const ch of line) {
    if (ch === '{') stack++;
    if (ch === '}') stack--;
  }
  if (stack < minStack) {
    minStack = stack;
    minLine = lineNum;
  }
  lineNum++;
}
if (minStack < 0)
  issues.push(`Lowest stack value ${minStack} at line ${minLine} (script-local lines)`);

if (stack > 0) issues.push(`Unclosed { braces: ${stack} remaining`);
if (issues.length === 0) console.log('Braces look balanced');
else issues.forEach((i) => console.log('ISSUE:', i));
process.exit(0);
