#!/usr/bin/env node
/*
Simple Consultant Proxy
- POST /api/consultant  { summary, prompt? }
- Forwards to Ollama (if OLLAMA_URL set) or OpenAI (if OPENAI_API_KEY set)
- Returns JSON: { action, args, confidence, explanation }

Usage:
  OLLAMA_URL=http://localhost:11434 OLLAMA_MODEL=llama2 ./server/consultant-proxy.js
  or
  OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-4o ./server/consultant-proxy.js
*/

const express = require('express');
const fetch = globalThis.fetch || require('node-fetch');
const bodyParser = require('body-parser');
const morgan = require('morgan');

const app = express();
app.use(morgan('tiny'));
app.use(bodyParser.json({ limit: '1mb' }));
const PORT = process.env.PORT || 11435;

// Basic health
app.get('/health', (req, res) => res.json({ ok: true }));

// POST /api/consultant
app.post('/api/consultant', async (req, res) => {
  try {
    const body = req.body || {};
    const summary = body.summary || {};
    const prompt = body.prompt || buildDefaultPrompt(summary);

    // Prefer Ollama if configured
    if (process.env.OLLAMA_URL) {
      const ollamaUrl = (process.env.OLLAMA_URL || '').replace(/\/$/, '');
      const model = process.env.OLLAMA_MODEL || 'llama2';
      // Ollama v0.1+ expects POST /api/generate or /v1/complete depending on version.
      // Try /api/generate first.
      const url = `${ollamaUrl}/api/generate`;
      const payload = { model, prompt };
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error('ollama failed: ' + r.status);
      const j = await r.json();
      // Ollama responses vary; try to extract text fields
      let text = null;
      if (j && j.results && Array.isArray(j.results) && j.results.length) {
        text = j.results.map((x) => x.content || x.output || '').join('\n');
      } else if (j && j.output) {
        text = Array.isArray(j.output) ? j.output.join('\n') : String(j.output);
      } else {
        text = JSON.stringify(j);
      }
      const parsed = tryParseResponse(text);
      return res.json(parsed);
    }

    // Fallback to OpenAI
    if (process.env.OPENAI_API_KEY) {
      const model = process.env.OPENAI_MODEL || 'gpt-4o';
      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are a simulation consultant. Return a single JSON object with keys: action(string), args(array), confidence(number 0..1), explanation(string).',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });
      if (!openaiRes.ok) throw new Error('openai failed: ' + openaiRes.status);
      const j = await openaiRes.json();
      const text =
        (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) ||
        JSON.stringify(j);
      const parsed = tryParseResponse(text);
      return res.json(parsed);
    }

    return res
      .status(400)
      .json({ error: 'No LLM provider configured. Set OLLAMA_URL or OPENAI_API_KEY.' });
  } catch (err) {
    console.error('consultant error', err);
    return res.status(500).json({ error: String(err) });
  }
});

function buildDefaultPrompt(summary) {
  const s = summary || {};
  return `Telemetry summary:\n${JSON.stringify(s)}\n\nInstruction: You are an expert simulation consultant. Recommend a single conservative action to improve stability or performance. Return a JSON object ONLY with keys: action (string), args (array), confidence (number 0..1), explanation (string). If no action is needed return action: "none".`;
}

function tryParseResponse(text) {
  try {
    // Try to find JSON snippet in text
    const m = text.match(/\{[\s\S]*\}/m);
    if (m) {
      const j = JSON.parse(m[0]);
      if (j && typeof j.action === 'string') return j;
    }
    // As fallback, return a safe structure
    return { action: 'none', args: [], confidence: 0.5, explanation: String(text).slice(0, 1000) };
  } catch (e) {
    return { action: 'none', args: [], confidence: 0.5, explanation: String(text).slice(0, 1000) };
  }
}

if (require.main === module) {
  app.listen(PORT, () => console.log(`Consultant proxy listening on ${PORT}`));
}

module.exports = app;
