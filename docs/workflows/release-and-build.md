# Release and Build

## Build outputs

The frontend production build output is written to `dist/`.

## Preview

Two supported options:

- `npm run preview` (Vite preview server)
- `npm run serve:dist` (Python stdlib server with SPA fallback)

## Release steps

TODO

## Versioning notes

TODO

## Automation

- Weekly safe refactor PR: `.github/workflows/weekly-refactor.yml` (runs `npm run format:write` + `npm run lint:fix` and opens a PR only if changes exist)
