const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

function runCommand(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true, ...opts });
  return res.status === 0;
}

function runHints({ feed = path.join(process.cwd(), 'build', 'webhint-feed.json') } = {}) {
  if (!fs.existsSync(feed)) {
    console.warn('Feed not found:', feed);
    return false;
  }
  const data = JSON.parse(fs.readFileSync(feed, 'utf8'));
  let success = true;

  // Run webhint for HTML files
  const htmlFiles = data.entries.filter((e) => e.lang === 'html').map((e) => e.path);
  if (htmlFiles.length) {
    console.log('Running webhint on', htmlFiles.length, 'html files');
    const ok = runCommand('npx', ['hint', ...htmlFiles]);
    success = success && ok;
  }

  // Run stylelint for CSS
  const cssFiles = data.entries.filter((e) => e.lang === 'css').map((e) => e.path);
  if (cssFiles.length) {
    console.log('Running stylelint on', cssFiles.length, 'css files');
    const ok = runCommand('npx', ['stylelint', ...cssFiles]);
    success = success && ok;
  }

  // Run eslint for js/ts
  const jsFiles = data.entries
    .filter((e) => e.lang === 'javascript' || e.lang === 'typescript')
    .map((e) => e.path);
  if (jsFiles.length) {
    console.log('Running eslint on', jsFiles.length, 'js/ts files');
    const ok = runCommand('npx', ['eslint', ...jsFiles]);
    success = success && ok;
  }

  // Java: attempt to run checkstyle if found
  const javaFiles = data.entries.filter((e) => e.lang === 'java').map((e) => e.path);
  if (javaFiles.length) {
    console.log('Java files present; attempting checkstyle (if available)');
    const ok = runCommand('checkstyle', ['-c', '/google_checks.xml', ...javaFiles]);
    success = success && ok; // if checkstyle exits non-zero, we'll surface it
  }

  return success;
}

if (require.main === module) {
  const res = runHints();
  process.exit(res ? 0 : 2);
}

module.exports = { runHints };
