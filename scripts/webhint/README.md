# Webhint Feed & Runner

This folder contains helper scripts to build a compact repository feed for HTML/CSS/TS/JS/Java files and to run linters against those files.

Usage

- Build the feed:

  npm run build:webhint-feed

- Run configured hints:

  npm run hint:run

- Run both:

  node scripts/webhint/index.js all

Notes

- The runner uses `npx hint` for HTML, `npx stylelint` for CSS, `npx eslint` for JS/TS, and attempts to run `checkstyle` for Java if available on PATH.
- The feed is written to `build/webhint-feed.json`.
