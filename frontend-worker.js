const PRIVATE_PATH = /^\/(?:\.|node_modules(?:\/|$)|src(?:\/|$)|functions(?:\/|$)|scripts(?:\/|$)|tests(?:\/|$)|supabase(?:\/|$)|config(?:\/|$)|(?:frontend-worker|worker)\.js$|wrangler(?:\.[^/]+)?\.jsonc$|package(?:-lock)?\.json$)/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.qiaobit.com' || (url.hostname === 'qiaobit.com' && url.protocol === 'http:')) {
      url.hostname = 'qiaobit.com';
      url.protocol = 'https:';
      return Response.redirect(url.toString(), 301);
    }

    // Preserve the deployed backend, including webhooks and non-site products.
    if (url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method)) {
      return env.LEGACY_SITE.fetch(request);
    }
    if (PRIVATE_PATH.test(url.pathname)) {
      return new Response('Not found', { status: 404 });
    }

    const assetUrl = url.pathname === '/ByteDanceVerify.html' ? new URL('/ByteDanceVerify', url) : null;
    const assetRequest = assetUrl || request.headers.has('range')
      ? new Request(assetUrl ?? request.url, { method: request.method, headers: withoutRange(request.headers) })
      : request;
    const response = await env.ASSETS.fetch(assetRequest);
    if (response.status !== 404) return withByteRanges(request, response);
    return env.LEGACY_SITE.fetch(request);
  }
};

// Static assets ignore Range, but iOS Safari refuses to play video without 206 responses.
// Inside the Worker the asset response may lack content-length, so fall back to buffering.
async function withByteRanges(request, response) {
  if (response.status !== 200 || response.headers.has('content-encoding')) return response;
  const declared = response.headers.get('content-length');
  const known = declared !== null && /^\d+$/.test(declared);
  const headers = new Headers(response.headers);
  headers.set('accept-ranges', 'bytes');
  const header = request.headers.get('range');
  if (!header || !isSingleRange(header)) return new Response(response.body, { status: 200, headers });

  let body = response.body;
  let size = known ? Number(declared) : 0;
  if (!known) {
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
    const buffer = new Uint8Array(await response.arrayBuffer());
    size = buffer.byteLength;
    body = buffer;
  }
  const range = parseRange(header, size);
  if (!range) return new Response(body, { status: 200, headers: withLength(headers, size) });

  if (range === 'unsatisfiable') {
    if (known) response.body?.cancel();
    headers.set('content-range', `bytes */${size}`);
    headers.delete('content-length');
    return new Response(null, { status: 416, headers });
  }

  const [start, end] = range;
  headers.set('content-range', `bytes ${start}-${end}/${size}`);
  headers.set('content-length', String(end - start + 1));
  if (request.method === 'HEAD' || !body) {
    if (known) response.body?.cancel();
    return new Response(null, { status: 206, headers });
  }
  const part = known ? sliceStream(body, start, end) : body.subarray(start, end + 1);
  return new Response(part, { status: 206, headers });
}

function withoutRange(source) {
  const headers = new Headers(source);
  headers.delete('range');
  headers.delete('if-range');
  return headers;
}

function withLength(headers, size) {
  headers.set('content-length', String(size));
  return headers;
}

function isSingleRange(header) {
  return /^bytes=\d*-\d*$/.test(header.trim());
}

// Returns [start, end] (inclusive), 'unsatisfiable', or null to serve the whole file.
function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '');
  if (!match || (match[1] === '' && match[2] === '')) return null;
  if (match[1] === '') {
    const suffix = Number(match[2]);
    return suffix === 0 ? 'unsatisfiable' : [Math.max(0, size - suffix), size - 1];
  }
  const start = Number(match[1]);
  const end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  if (start >= size) return 'unsatisfiable';
  return start > end ? null : [start, end];
}

function sliceStream(body, start, end) {
  let offset = 0;
  return body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      const from = Math.max(start - offset, 0);
      const to = Math.min(end + 1 - offset, chunk.byteLength);
      offset += chunk.byteLength;
      if (from < to) controller.enqueue(chunk.subarray(from, to));
      if (offset > end) controller.terminate();
    }
  }));
}
