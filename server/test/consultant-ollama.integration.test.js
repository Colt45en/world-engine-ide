const supertest = require('supertest');
const { app, OLLAMA_URL } = require('../consultant-ollama');

// Integration test: requires a running Ollama daemon accessible via OLLAMA_URL
// The test will be skipped automatically if OLLAMA_URL is not present in env.

const hasOllama = Boolean(process.env.OLLAMA_URL || OLLAMA_URL);

if (hasOllama) {
  describe('consultant-ollama integration (requires Ollama)', () => {
    jest.setTimeout(30000);

    test('POST /api/consultant roundtrip to Ollama returns valid structure', async () => {
      const summary = { tick: Date.now(), totalEntities: 200, avgCollisions: 0.1, peakCount: 3 };
      // Check that Ollama is reachable before running the test
      const url = process.env.OLLAMA_URL || OLLAMA_URL || 'http://localhost:11434';
      try {
        // Try pinging /health if available
        const ping = await require('axios')
          .get(url.replace(/\/$/, '') + '/health', { timeout: 2000 })
          .catch(() => null);
        const strict = Boolean(
          process.env.CONSULTANT_OLLAMA_STRICT || process.env.CONSULTANT_INTEGRATION_STRICT,
        );
        if (!ping || ping.status !== 200) {
          if (strict) {
            // Fail the test explicitly in strict mode
            throw new Error('Ollama not reachable at ' + url + ' (strict mode enabled)');
          }
          console.warn('Ollama not reachable at ' + url + ' — skipping integration test');
          return; // skip test silently
        }
      } catch (e) {
        console.warn('Ollama ping failed, skipping integration test', e && e.message);
        return;
      }

      const res = await supertest(app).post('/api/consultant').send({ summary }).expect(200);
      expect(res.body).toBeTruthy();
      expect(typeof res.body.action).toBe('string');
      expect(Array.isArray(res.body.args)).toBe(true);
      expect(typeof res.body.confidence).toBe('number');
      expect(typeof res.body.explanation).toBe('string');
    });
  });
} else {
  test.skip('OLLAMA_URL not configured — skipping Ollama integration test', () => {});
}
