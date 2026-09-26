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

const video = new Uint8Array(Array.from({ length: 100 }, (_, i) => i));
const mediaEnv = () => ({
  ASSETS: { fetch: async () => new Response(video, { headers: { 'content-type': 'video/mp4', 'content-length': '100', etag: '"v1"' } }) },
  LEGACY_SITE: { fetch: () => assert.fail('unexpected legacy call') }
});
const bytes = async (response) => [...new Uint8Array(await response.arrayBuffer())];

test('answers byte-range requests with 206 partial content so iOS Safari can play video', async () => {
  const cases = [['bytes=0-1', 0, 1], ['bytes=10-19', 10, 19], ['bytes=90-', 90, 99], ['bytes=-5', 95, 99], ['bytes=95-500', 95, 99]];
  for (const [range, start, end] of cases) {
    const response = await worker.fetch(new Request('https://qiaobit.com/site-tour.mp4', { headers: { range } }), mediaEnv());
    assert.equal(response.status, 206, range);
    assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/100`, range);
    assert.equal(response.headers.get('content-length'), String(end - start + 1), range);
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.equal(response.headers.get('content-type'), 'video/mp4');
    assert.deepEqual(await bytes(response), Array.from({ length: end - start + 1 }, (_, i) => start + i), range);
  }
});

test('advertises range support on full responses and rejects unsatisfiable ranges', async () => {
  const full = await worker.fetch(new Request('https://qiaobit.com/site-tour.mp4'), mediaEnv());
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('accept-ranges'), 'bytes');
  assert.equal((await bytes(full)).length, 100);

  const tooFar = await worker.fetch(new Request('https://qiaobit.com/site-tour.mp4', { headers: { range: 'bytes=100-' } }), mediaEnv());
  assert.equal(tooFar.status, 416);
  assert.equal(tooFar.headers.get('content-range'), 'bytes */100');

  // Multi-range and malformed headers fall back to the full file.
  for (const range of ['bytes=0-1,5-6', 'items=0-1', 'bytes=abc']) {
    const response = await worker.fetch(new Request('https://qiaobit.com/site-tour.mp4', { headers: { range } }), mediaEnv());
    assert.equal(response.status, 200, range);
  }
});

test('answers HEAD range requests without a body', async () => {
  const response = await worker.fetch(new Request('https://qiaobit.com/site-tour.mp4', { method: 'HEAD', headers: { range: 'bytes=0-1' } }), {
    ASSETS: { fetch: async () => new Response(null, { headers: { 'content-type': 'video/mp4', 'content-length': '100' } }) },
    LEGACY_SITE: { fetch: () => assert.fail('unexpected legacy call') }
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), 'bytes 0-1/100');
  assert.equal(response.body, null);
});

test('slices ranges that span several streamed chunks', async () => {
  const chunks = [video.slice(0, 7), video.slice(7, 30), video.slice(30, 31), video.slice(31, 100)];
  const env = {
    ASSETS: { fetch: async () => new Response(new ReadableStream({
      start(controller) { chunks.forEach(chunk => controller.enqueue(chunk)); controller.close(); }
    }), { headers: { 'content-type': 'video/mp4', 'content-length': '100' } }) },
    LEGACY_SITE: { fetch: () => assert.fail('unexpected legacy call') }
  };
  const response = await worker.fetch(new Request('https://qiaobit.com/site-tour.mp4', { headers: { range: 'bytes=5-35' } }), env);
  assert.equal(response.status, 206);
  assert.deepEqual(await bytes(response), Array.from({ length: 31 }, (_, i) => 5 + i));
});

test('handles ranges when the asset response carries no content-length (as in production)', async () => {
  let forwardedRange = 'unset';
  const env = {
    ASSETS: { fetch: async (req) => {
      forwardedRange = req.headers.get('range');
      return new Response(new ReadableStream({
        start(controller) { controller.enqueue(video.slice(0, 40)); controller.enqueue(video.slice(40)); controller.close(); }
      }), { headers: { 'content-type': 'video/mp4' } });
    } },
    LEGACY_SITE: { fetch: () => assert.fail('unexpected legacy call') }
  };
  const response = await worker.fetch(new Request('https://qiaobit.com/site-tour.mp4', { headers: { range: 'bytes=38-41' } }), env);
  assert.equal(forwardedRange, null, 'the asset store must be asked for the whole file');
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('content-range'), 'bytes 38-41/100');
  assert.equal(response.headers.get('content-length'), '4');
  assert.deepEqual(await bytes(response), [38, 39, 40, 41]);

  const suffix = await worker.fetch(new Request('https://qiaobit.com/site-tour.mp4', { headers: { range: 'bytes=-3' } }), env);
  assert.equal(suffix.headers.get('content-range'), 'bytes 97-99/100');
  assert.deepEqual(await bytes(suffix), [97, 98, 99]);

  const plain = await worker.fetch(new Request('https://qiaobit.com/'), {
    ASSETS: { fetch: async () => new Response('page') },
    LEGACY_SITE: { fetch: () => assert.fail('unexpected legacy call') }
  });
  assert.equal(plain.status, 200);
  assert.equal(await plain.text(), 'page');
});

test('shows the branded 404 page to browsers when neither assets nor legacy backend have the page', async () => {
  const requested = [];
  const env = {
    ASSETS: { fetch: async (req) => {
      const { pathname } = new URL(req.url);
      requested.push(pathname);
      if (pathname === '/404') return new Response('<h1>branded 404</h1>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
      return new Response('missing', { status: 404 });
    } },
    LEGACY_SITE: { fetch: async () => new Response(null, { status: 404 }) }
  };
  const response = await worker.fetch(new Request('https://qiaobit.com/no-such-page', {
    headers: { accept: 'text/html,application/xhtml+xml' }
  }), env);
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), '<h1>branded 404</h1>');
  assert.deepEqual(requested, ['/no-such-page', '/404']);
});

test('keeps plain legacy 404s for non-HTML requests and when the 404 page is unavailable', async () => {
  const legacy404 = () => new Response('legacy missing', { status: 404 });
  const missingAsset = await worker.fetch(new Request('https://qiaobit.com/missing.js', { headers: { accept: '*/*' } }), {
    ASSETS: { fetch: async () => new Response('missing', { status: 404 }) },
    LEGACY_SITE: { fetch: async () => legacy404() }
  });
  assert.equal(missingAsset.status, 404);
  assert.equal(await missingAsset.text(), 'legacy missing');

  const noPage = await worker.fetch(new Request('https://qiaobit.com/no-such-page', { headers: { accept: 'text/html' } }), {
    ASSETS: { fetch: async () => new Response('missing', { status: 404 }) },
    LEGACY_SITE: { fetch: async () => legacy404() }
  });
  assert.equal(noPage.status, 404);
  assert.equal(await noPage.text(), 'legacy missing');
});
