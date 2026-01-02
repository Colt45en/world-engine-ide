const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function findRepoPython(repoRoot) {
  const candidates = [
    path.join(repoRoot, '.venv', 'Scripts', 'python.exe'), // Windows venv
    path.join(repoRoot, '.venv', 'bin', 'python'), // macOS/Linux venv
  ];

  for (const candidate of candidates) {
    if (fileExists(candidate)) return candidate;
  }

  return null;
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const python = findRepoPython(repoRoot) || process.env.PYTHON || 'python';

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/run-python.cjs <script.py> [args...]');
    process.exit(2);
  }

  const result = spawnSync(python, args, {
    stdio: 'inherit',
    cwd: repoRoot,
    env: process.env,
  });

  if (result.error) {
    console.error(result.error.message || String(result.error));
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}

main();
