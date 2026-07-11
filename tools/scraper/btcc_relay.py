"""
Shared helper for scrapers fetching btcc.net through the btcc-relay
Cloudflare Worker (cf-worker/worker.js). btcc.net's origin blocks direct
requests from GitHub Actions/GCP (and other well-known cloud/datacenter
ASNs) with a 403 regardless of TLS fingerprint, but requests routed
through Cloudflare's own network - which btcc.net sits behind - are
trusted, so the relay rides that trusted path instead.
"""

import os
import sys
from urllib.parse import quote

from curl_cffi import requests as cffi_requests

RELAY_URL = "https://btcc-relay.yacobwood.workers.dev"


def fetch_via_relay(url: str, timeout: int = 15):
    """Fetch a btcc.net URL through the relay. Raises on a non-2xx response."""
    secret = os.environ.get("SCRAPER_SECRET")
    if not secret:
        print("ERROR: SCRAPER_SECRET env var not set", file=sys.stderr)
        raise RuntimeError("SCRAPER_SECRET not set")
    r = cffi_requests.get(
        f"{RELAY_URL}/?url={quote(url, safe='')}",
        headers={"x-relay-secret": secret},
        impersonate="chrome120",
        timeout=timeout,
    )
    r.raise_for_status()
    return r
