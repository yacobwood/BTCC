/**
 * btcc-relay - fetches btcc.net pages on behalf of the scraper workflows.
 *
 * btcc.net's origin blocks direct requests from GitHub Actions/GCP (and any
 * other well-known cloud/datacenter ASN) with a 403, regardless of TLS
 * fingerprint - but requests routed through Cloudflare's own network (which
 * btcc.net sits behind) are trusted. Running this fetch inside a Cloudflare
 * Worker rides that trusted path, so the scrapers can go back to running on
 * ordinary GitHub-hosted runners instead of anywhere near a specific machine.
 *
 * Usage: GET /?url=https://btcc.net/calendar/
 * Auth:  header x-relay-secret must match the RELAY_SECRET binding.
 * Only https://btcc.net and https://www.btcc.net targets are allowed.
 */
export default {
  async fetch(request, env) {
    if (request.headers.get('x-relay-secret') !== env.RELAY_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const target = new URL(request.url).searchParams.get('url');
    if (!target) {
      return new Response('Missing url param', { status: 400 });
    }

    let targetUrl;
    try {
      targetUrl = new URL(target);
    } catch {
      return new Response('Invalid url param', { status: 400 });
    }
    if (!['btcc.net', 'www.btcc.net'].includes(targetUrl.hostname) || targetUrl.protocol !== 'https:') {
      return new Response('Target host not allowed', { status: 403 });
    }

    const upstream = await fetch(targetUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('Content-Type') || 'text/html' },
    });
  },
};
