# VS Code Search Filters (Include/Exclude) — Manual

This doc explains the two pattern boxes in the **Search** view:

- **Files to include**: only search files whose _paths_ match these patterns.
- **Files to exclude**: do **not** search files whose _paths_ match these patterns.

Patterns are **workspace-relative**, use **forward slashes** (`/`), and you can separate multiple patterns with commas.

---

## Quick Start

### Search only within a folder

- Include: `./public/**`

### Search only within one feature area

- Include: `./brain/**`

### Search only specific file types

- Include: `{**/*.js,**/*.jsx,**/*.ts,**/*.tsx}`
- Include: `{**/*.py,**/*.md}`

### Exclude noisy folders

- Exclude: `{**/node_modules/**,**/dist/**,**/build/**,**/.venv/**,**/__pycache__/**}`

---

## Glob Pattern Cheatsheet

VS Code Search supports glob-like patterns:

- `*` matches **zero or more** characters **within a path segment**
- `?` matches **one** character within a path segment
- `**` matches **any number** of path segments (including none)
- `{a,b}` groups alternatives (OR)
- `[0-9]` range of characters
- `[!0-9]` negated range

Examples:

- `**/*.html` matches all HTML files
- `./public/tools/**` matches everything under `public/tools/`
- `{**/*.test.js,**/*.test.ts}` matches JS/TS test files

---

## Important Differences (Search View vs Settings)

- In the **Search view**, the `**/` prefix is effectively assumed.
  - If you type `example`, it will match folders/files named `example` anywhere.
- In **settings** like `files.exclude` / `search.exclude`, patterns are evaluated differently.
  - For settings, you often need `**/example` to match `folder1/example`.

---

## The Toggle: “Use Exclude Settings and Ignore Files”

In the Search view, there’s a toggle in the exclude box:

- When enabled: Search respects `.gitignore`, `files.exclude`, and `search.exclude`.
- When disabled: Search ignores those defaults and uses only what you type in the include/exclude boxes.

This is useful when you temporarily want to search inside normally-ignored folders.

---

## Copy/Paste Recipes for This Repo

### Focus only on the static tools (HTML tools)

- Include: `./public/tools/**`

### Search only the Nexus/legacy static content

- Include: `./public/nexus/**`

### Search only the React frontend source

- Include: `./src/**`

### Search only Python brain code

- Include: `./brain/**`
- (If you want only sources) Include: `./brain/src/**`

### Search only tests

- Include: `{./test/**,./tests/**,./brain/tests/**}`

### Exclude common build outputs in this repo

- Exclude: `{./node_modules/**,./dist/**,./build/**,./__pycache__/**,./artifacts/**,./hint-report/**}`

---

## Tips

- From the Explorer, right-click a folder → **Find in Folder** to scope search instantly.
- Use **Search Editor** (Search view → “Open New Search Editor”) to keep results in a real editor tab.
- Regex replace can case-transform capture groups with `\\u`, `\\U`, `\\l`, `\\L`.
