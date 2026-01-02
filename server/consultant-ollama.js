import axios from 'axios';
import express from 'express';
import morgan from 'morgan';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const app = express();
app.use(morgan('tiny'));
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.CONSULTANT_PORT || process.env.PORT || 11436;
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama2';

// Build a shaped prompt for the LLM from telemetry
function buildPrompt(summary) {
  const s = summary || {};
  return `Telemetry summary:\n${JSON.stringify(s, null, 2)}\n\nInstruction:\nYou are an expert simulation consultant. Given the telemetry summary, recommend a single conservative action to improve stability or performance. Return a JSON object ONLY with keys: action (string), args (array), confidence (number 0..1), explanation (string). If no action is needed return action: "none".`;
}

// Try to extract JSON object from text
function extractJson(text) {
  if (!text) return null;
  const rx = /\{[\s\S]*\}/m;
  const m = text.match(rx);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch (e) {
      return null;
    }
  }
  return null;
}

// POST /api/consultant - accepts { summary, prompt? }
app.post('/api/consultant', async (req, res) => {
  try {
    const body = req.body || {};
    const summary = body.summary || {};
    const prompt = body.prompt || buildPrompt(summary);

    // Call Ollama v0.1+ generate endpoint
    const url = `${OLLAMA_URL}/api/generate`;
    const payload = { model: OLLAMA_MODEL, prompt };
    const r = await axios.post(url, payload, { timeout: 10000 });
    const data = r && r.data ? r.data : null;

    let text = null;
    if (data && data.results && Array.isArray(data.results)) {
      // join content fields
      text = data.results.map((x) => x.content || x.output || '').join('\n');
    } else if (data && data.output) {
      text = Array.isArray(data.output) ? data.output.join('\n') : String(data.output);
    } else {
      text = JSON.stringify(data);
    }

    const parsed = extractJson(text) || {
      action: 'none',
      args: [],
      confidence: 0.5,
      explanation: String(text).slice(0, 1000),
    };
    // Ensure fields
    parsed.action = typeof parsed.action === 'string' ? parsed.action : 'none';
    parsed.args = Array.isArray(parsed.args) ? parsed.args : [];
    parsed.confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;
    parsed.explanation = parsed.explanation || '';

    res.json(parsed);
  } catch (err) {
    console.error('consultant-ollama error', err && err.message);
    res
      .status(502)
      .json({ action: 'none', args: [], confidence: 0.5, explanation: String(err && err.message) });
  }
});

// Health and info
app.get('/health', (req, res) => res.json({ ok: true, provider: 'ollama', url: OLLAMA_URL }));

const isMain = process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  app.listen(PORT, () =>
    console.log(`Consultant Ollama proxy listening on ${PORT} -> ${OLLAMA_URL}`),
  );
}

export { app, buildPrompt, extractJson, OLLAMA_URL };
