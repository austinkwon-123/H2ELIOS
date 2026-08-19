const assert = require('node:assert/strict');
const test = require('node:test');

// Pin the empty value before dotenv loads. dotenv does not overwrite an
// existing variable, which gives this test the same environment as a fresh
// clone with no .env file even when a developer has local credentials.
process.env.DATABASE_URL = '';
process.env.FINNHUB_KEY = '';

const app = require('../server');

test('a fresh clone serves the app and degrades database routes to 503', async (t) => {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const page = await fetch(`${baseUrl}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /H2ELIOS/);

  const analytics = await fetch(`${baseUrl}/api/analytics/summary`);
  assert.equal(analytics.status, 503);
  assert.deepEqual(await analytics.json(), {
    error: 'Live project analytics require DATABASE_URL'
  });

  const quotes = await fetch(`${baseUrl}/api/quotes?symbols=PLUG`);
  assert.equal(quotes.status, 200);
  assert.deepEqual(await quotes.json(), {
    configured: false,
    quotes: {},
    failed: []
  });
});
