const axios = require('axios');
const { buildPrompt, extractJson, app } = require('../consultant-ollama');
const supertest = require('supertest');

jest.mock('axios');

describe('consultant-ollama', () => {
  test('buildPrompt returns JSON-like prompt', () => {
    const p = buildPrompt({ tick: 123, totalEntities: 100 });
    expect(typeof p).toBe('string');
    expect(p).toContain('Telemetry summary');
    expect(p).toContain('tick');
  });

  test('extractJson finds JSON in text', () => {
    const txt =
      'Some text \n {"action":"reduce_dt","args":[0.01],"confidence":0.9,"explanation":"ok"}\n more';
    const j = extractJson(txt);
    expect(j).toBeTruthy();
    expect(j.action).toBe('reduce_dt');
  });

  test('POST /api/consultant returns parsed JSON from mocked Ollama', async () => {
    // mock axios.post to return ollama-like structure
    axios.post.mockResolvedValue({
      data: {
        results: [
          {
            content:
              '{"action":"increase_cellSize","args":[128],"confidence":0.85,"explanation":"hotspot"}]',
          },
        ],
      },
    });
    const resp = await supertest(app)
      .post('/api/consultant')
      .send({ summary: { tick: 1 } })
      .expect(200);
    expect(resp.body).toBeTruthy();
    expect(resp.body.action).toBe('increase_cellSize');
    expect(Array.isArray(resp.body.args)).toBe(true);
  });

  test('POST /api/consultant handles errors gracefully', async () => {
    axios.post.mockRejectedValue(new Error('network'));
    const resp = await supertest(app)
      .post('/api/consultant')
      .send({ summary: { tick: 2 } })
      .expect(502);
    expect(resp.body.action).toBe('none');
  });
});
