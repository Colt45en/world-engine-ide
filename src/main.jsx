import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app.jsx';
import WorldEngine from './core/world-engine.js';
import './styles/global.css';

if (!globalThis.__WORLD_ENGINE__) {
  const engine = new WorldEngine({ logger: console });
  engine.initialize();
  globalThis.__WORLD_ENGINE__ = engine;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
