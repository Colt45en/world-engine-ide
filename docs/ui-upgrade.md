# UI Upgrade: Tailwind + React Three

This repo now includes scaffolding for a production-style UI upgrade.

What I added:

- `tailwind.config.cjs` and `postcss.config.cjs` (Tailwind config)
- `src/index.css` with Tailwind directives
- `src/components/ThreeBg/ThreeScene.jsx` — a minimal `@react-three/fiber` scene
- Wrote `src/components/Studio/WowLite.jsx` to optionally render the React canvas (toggle `Use React Canvas`)
- Updated `package.json` to include `tailwindcss`, `postcss`, `autoprefixer`, `@react-three/fiber`, `@react-three/drei`

Install & run:

```bash
npm install
npm run dev
```

Notes:

- The Three canvas uses `@react-three/fiber` and `@react-three/drei` for convenience. This is the recommended React approach.
- Tailwind is wired via PostCSS. Add Tailwind classes to components or pages (e.g., the Studio components) for quick, consistent styling.
- If you'd like, I can migrate key studio components to Tailwind classnames and convert `Public/tools/wow-lite.html` demo to a React-powered page (recommended for long-term maintenance).
