#!/usr/bin/env python3
"""
Scrape BTCC team merch stores and update data/merch.json.

Uses Shopify's public /products.json API where available (EXCELR8/Vertu).
Falls back to Playwright for non-Shopify stores.

Usage:
    python tools/scraper/scrape_merch.py
"""

import json
import os
import re
import sys
from datetime import datetime, timezone

import requests

DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "data", "merch.json")

# Team store configs: (store_base_url, team_name, seller_type, driver_ids, team_ids)
SHOPIFY_STORES = [
    {
        "base_url": "https://excelr8motorsportshop.com",
        "collection": "excelr8-btcc-clothing",
        "seller_name": "Team VERTU",
        "seller_id": "vertu",
        "team_ids": ["Team VERTU"],
        "driver_ids": [80, 3],  # Ingram, Chilton
    },
]

# Tayna.co.uk categories to scrape for NAPA Racing
TAYNA_STORES = [
    {
        "base_url": "https://www.tayna.co.uk",
        "categories": [
            "/napa-racing/hats/",
            "/napa-racing/t-shirts/",
            "/napa-racing/polos/",
            "/napa-racing/jackets/",
            "/napa-racing/tracktops/",
            "/napa-racing/gilets/",
        ],
        "seller_name": "NAPA Racing UK",
        "seller_id": "napa",
        "team_ids": ["NAPA Racing UK"],
        "driver_ids": [116, 27, 77, 200],
    },
]


def fetch_tayna_products(base_url, category_path):
    """Scrape products from a Tayna.co.uk category page."""
    url = base_url + category_path
    resp = requests.get(url, headers={"User-Agent": "BTCCFanHub-Scraper/1.0"}, timeout=30)
    resp.raise_for_status()
    html = resp.text

    products = []
    # Extract product links with full titles from category page
    # Pattern: href="/napa-racing/category/code/" ... title text
    links = re.findall(
        r'href="(/napa-racing/[^/]+/([a-z0-9]+)/)"[^>]*>\s*(?:<[^>]+>)*\s*([^<]+)',
        html,
    )

    # Extract image URLs
    images = re.findall(r'(https://images\.tayna\.com/prod-images/[^"\'>\s]+)', html)

    # Extract prices (from rendered page, may need JS — try anyway)
    prices = re.findall(r'£([\d.]+)', html)

    seen = set()
    skip = {"hats", "t-shirts", "polos", "jackets", "tracktops", "gilets"}
    img_idx = 0

    for link_path, code, raw_title in links:
        if code in seen or code in skip:
            continue
        title = raw_title.strip()
        if not title or title in ("Specification", "More Info", "Reviews"):
            continue
        seen.add(code)

        # Clean title — remove product code suffix like "- NRME2138"
        title = re.sub(r'\s*-\s*NRME?\d+\s*$', '', title, flags=re.IGNORECASE).strip()
        # Also remove size suffixes like "(XL)", "(3XL)", "(S)" etc
        title = re.sub(r'\s*\([A-Z0-9]+\)\s*$', '', title).strip()

        # Get image if available
        image_url = images[img_idx] if img_idx < len(images) else ""
        img_idx += 1

        # Try to get price from product page (quick fetch)
        price = ""
        try:
            prod_resp = requests.get(base_url + link_path, headers={"User-Agent": "BTCCFanHub-Scraper/1.0"}, timeout=15)
            price_match = re.search(r'£\s*([\d.]+)', prod_resp.text)
            if price_match:
                price = f"£{price_match.group(1)}"
        except Exception:
            pass

        products.append({
            "code": code,
            "title": title,
            "price": price,
            "image_url": image_url,
            "url": base_url + link_path,
        })

    return products


def tayna_product_to_merch_item(product, store_config):
    """Convert a Tayna product to a merch feed item."""
    return {
        "id": f"{store_config['seller_id']}-{product['code']}",
        "title": product["title"],
        "imageUrl": product["image_url"],
        "price": product["price"],
        "currency": "GBP",
        "sellerName": store_config["seller_name"],
        "sellerType": "team",
        "purchaseUrl": product["url"],
        "affiliateParams": {},
        "sponsored": False,
        "driverIds": store_config["driver_ids"],
        "teamIds": store_config["team_ids"],
        "roundTags": [],
        "_available": True,
    }


def fetch_shopify_products(base_url, collection=None):
    """Fetch products from a Shopify store's public JSON API."""
    if collection:
        url = f"{base_url}/collections/{collection}/products.json?limit=50"
    else:
        url = f"{base_url}/products.json?limit=50"

    resp = requests.get(url, headers={"User-Agent": "BTCCFanHub-Scraper/1.0"}, timeout=30)
    resp.raise_for_status()
    return resp.json().get("products", [])


def shopify_product_to_merch_item(product, store_config):
    """Convert a Shopify product JSON to a merch feed item."""
    # Get the first variant for price
    variants = product.get("variants", [])
    price_str = ""
    if variants:
        price = variants[0].get("price", "0.00")
        price_str = f"£{price}"

    # Get the first image
    images = product.get("images", [])
    image_url = images[0]["src"] if images else ""

    # Check availability
    available = any(v.get("available", False) for v in variants)

    # Build a stable ID from handle
    handle = product.get("handle", "")
    item_id = f"{store_config['seller_id']}-{handle}"

    return {
        "id": item_id,
        "title": product.get("title", ""),
        "imageUrl": image_url,
        "price": price_str,
        "currency": "GBP",
        "sellerName": store_config["seller_name"],
        "sellerType": "team",
        "purchaseUrl": f"{store_config['base_url']}/products/{handle}",
        "affiliateParams": {},
        "sponsored": False,
        "driverIds": store_config["driver_ids"],
        "teamIds": store_config["team_ids"],
        "roundTags": [],
        "_available": available,
    }


def load_existing_feed():
    """Load the existing merch.json feed."""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return {"lastUpdated": "", "items": [], "sellers": []}


def save_feed(feed):
    """Save the merch feed to data/merch.json."""
    with open(DATA_FILE, "w") as f:
        json.dump(feed, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(feed['items'])} items to {DATA_FILE}")


def merge_scraped_items(feed, scraped_items, seller_id):
    """
    Merge scraped items into the feed.
    - Updates existing items (matched by id) with fresh data
    - Adds new items not already in the feed
    - Removes items from this seller that are no longer on the store
    """
    # Separate items: those from this seller vs others
    other_items = [i for i in feed["items"] if not i["id"].startswith(f"{seller_id}-")]
    scraped_by_id = {i["id"]: i for i in scraped_items}

    # Only keep available items
    available_items = [i for i in scraped_items if i.pop("_available", True)]

    # Merge: other sellers' items + fresh scraped items
    feed["items"] = other_items + available_items
    return feed


def main():
    feed = load_existing_feed()
    total_scraped = 0

    for store in SHOPIFY_STORES:
        print(f"\nScraping {store['seller_name']} ({store['base_url']})...")
        try:
            products = fetch_shopify_products(store["base_url"], store.get("collection"))
            print(f"  Found {len(products)} products")

            items = [shopify_product_to_merch_item(p, store) for p in products]
            total_scraped += len(items)

            feed = merge_scraped_items(feed, items, store["seller_id"])
            print(f"  Merged {len(items)} items for {store['seller_name']}")

        except Exception as e:
            print(f"  ERROR scraping {store['seller_name']}: {e}", file=sys.stderr)
            continue

    for store in TAYNA_STORES:
        print(f"\nScraping {store['seller_name']} ({store['base_url']})...")
        try:
            all_products = []
            for cat in store["categories"]:
                print(f"  Category: {cat}")
                products = fetch_tayna_products(store["base_url"], cat)
                print(f"    Found {len(products)} products")
                all_products.extend(products)

            items = [tayna_product_to_merch_item(p, store) for p in all_products]
            total_scraped += len(items)

            feed = merge_scraped_items(feed, items, store["seller_id"])
            print(f"  Merged {len(items)} items for {store['seller_name']}")

        except Exception as e:
            print(f"  ERROR scraping {store['seller_name']}: {e}", file=sys.stderr)
            continue

    # Update timestamp
    feed["lastUpdated"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    save_feed(feed)
    print(f"\nDone. Scraped {total_scraped} items total.")


if __name__ == "__main__":
    main()
