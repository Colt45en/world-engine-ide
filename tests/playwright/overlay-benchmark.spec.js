const { test, expect } = require('@playwright/test');

test('overlay benchmark runs and returns a report', async ({ page }) => {
  await page.goto('/tools/nexus-dual.html');
  // Wait for the run button to be available
  await page.waitForSelector('#btn-run-overlay-bench', { timeout: 30000 });
  // Run benchmark
  await page.click('#btn-run-overlay-bench');

  const resultEl = page.locator('#overlay-benchmark-result');
  // Wait for the result element to contain JSON with avgComputeMs
  await expect(resultEl).toHaveText(/avgComputeMs/, { timeout: 120000 });

  const text = await resultEl.textContent();
  let res = null;
  try {
    res = JSON.parse(text);
  } catch (e) {
    /* ignore parse errors */
  }
  expect(res).not.toBeNull();
  expect(res).toHaveProperty('avgComputeMs');
});
