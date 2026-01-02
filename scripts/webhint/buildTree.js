const fs = require('fs');
const path = require('path');
const glob = require('glob');

function detectLang(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html' || ext === '.htm') return 'html';
  if (ext === '.css') return 'css';
  if (ext === '.js') return 'javascript';
  if (ext === '.ts') return 'typescript';
  if (ext === '.java') return 'java';
  return 'unknown';
}

function firstNLines(content, n = 40) {
  return content.split(/\r?\n/).slice(0, n).join('\n');
}

function buildTree({
  root = process.cwd(),
  out = path.join(process.cwd(), 'build', 'webhint-feed.json'),
  patterns,
} = {}) {
  patterns = patterns || ['**/*.html', '**/*.htm', '**/*.css', '**/*.js', '**/*.ts', '**/*.java'];
  const files = new Set();
  for (const pat of patterns) {
    const matches = glob.sync(pat, {
      cwd: root,
      nodir: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    });
    for (const m of matches) files.add(path.join(root, m));
  }

  const entries = [];
  for (const f of Array.from(files)) {
    try {
      const stat = fs.statSync(f);
      const content = fs.readFileSync(f, 'utf8');
      entries.push({
        path: path.relative(root, f),
        absPath: f,
        lang: detectLang(f),
        size: stat.size,
        firstLines: firstNLines(content, 80),
        mtimeMs: stat.mtimeMs,
      });
    } catch (e) {
      // skip
    }
  }

  const payload = { generatedAt: Date.now(), root: path.resolve(root), entries };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  return payload;
}

if (require.main === module) {
  const out = process.argv[2] || undefined;
  const res = buildTree({ out });
  console.log(
    'Built webhint feed with',
    res.entries.length,
    'entries ->',
    out || 'build/webhint-feed.json',
  );
}

module.exports = { buildTree };
