import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../frontend-worker.js';

test('serves new website assets without calling the legacy backend', async () => {
  const response = await worker.fetch(new Request('https://qiaobit.com/'), {
    ASSETS: { fetch: async () => new Response('new website') },
    LEGACY_SITE: { fetch: () => assert.fail('unexpected legacy call') }
  });
  assert.equal(await response.text(), 'new website');
});

test('passes API methods, body, headers and query unchanged to the existing backend', async () => {
  for (const method of ['GET', 'POST', 'OPTIONS']) {
    const request = new Request('https://qiaobit.com/api/stripe-webhook?test=1', {
      method,
      headers: { 'stripe-signature': 'test-signature' },
      ...(method === 'POST' ? { body: 'untouched payload' } : {})
    });
    const response = await worker.fetch(request, {
      ASSETS: { fetch: () => assert.fail('API must not call assets') },
      LEGACY_SITE: { fetch: async (forwarded) => {
        assert.equal(forwarded, request);
        return new Response('backend', { status: 202 });
      } }
    });
    assert.equal(response.status, 202);
  }
});

test('retains old product pages and assets that are absent from this repository', async () => {
  for (const path of ['/rongyifa/', '/skill-letter', '/old-product.js']) {
    const response = await worker.fetch(new Request(`https://qiaobit.com${path}`), {
      ASSETS: { fetch: async () => new Response('missing', { status: 404 }) },
      LEGACY_SITE: { fetch: async () => new Response('legacy asset') }
    });
    assert.equal(await response.text(), 'legacy asset');
  }
});

test('blocks source files and preserves the canonical-domain redirect', async () => {
  const env = {
    ASSETS: { fetch: () => assert.fail('private file') },
    LEGACY_SITE: { fetch: () => assert.fail('private file') }
  };
  for (const path of ['/.env', '/frontend-worker.js', '/wrangler.frontend.jsonc', '/src/demo.js', '/package.json']) {
    assert.equal((await worker.fetch(new Request(`https://qiaobit.com${path}`), env)).status, 404);
  }
  const response = await worker.fetch(new Request('https://www.qiaobit.com/?ref=1'), env);
  assert.equal(response.status, 301);
  assert.equal(response.headers.get('location'), 'https://qiaobit.com/?ref=1');
});
