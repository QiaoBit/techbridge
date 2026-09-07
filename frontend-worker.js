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

    const assetRequest = url.pathname === '/ByteDanceVerify.html'
      ? new Request(new URL('/ByteDanceVerify', url), request)
      : request;
    const response = await env.ASSETS.fetch(assetRequest);
    if (response.status !== 404) return response;
    return env.LEGACY_SITE.fetch(request);
  }
};
