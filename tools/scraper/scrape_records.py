#!/usr/bin/env python3
"""
BTCC All-Time Records Scraper
Source: https://www.motorsportstats.com/series/british-touring-car-championship/records/2025

Navigation:
  - Top tabs: Overall | Win records | Podium records | Pole positions records |
               Fastest laps records | Best finish records | … (overflow)
    → use selector: [class*="TabTitle"]
  - Clicking a top tab reveals a dropdown of sub-categories in the sidebar
  - The leaderboard table has columns: POS | COUNTRY | DRIVER | <value>

Usage:
    cd tools/scraper
    .venv/bin/python scrape_records.py
"""

import json
import re
import time
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE_URL = "https://www.motorsportstats.com/series/british-touring-car-championship/records/2025"
OUT_DIR  = Path(__file__).resolve().parent.parent.parent / "data" / "records"

# Sidebar label (lowercase) → (json key, JS const name)
LABEL_TO_CONST = {
    "championships":               ("championships",       "CHAMPIONSHIPS_OFFICIAL"),
    "starts":                      ("starts",              "STARTS_OFFICIAL"),
    "hattricks":                   ("hatTricks",           "HAT_TRICKS_OFFICIAL"),
    "hat tricks":                  ("hatTricks",           "HAT_TRICKS_OFFICIAL"),
    "hat-tricks":                  ("hatTricks",           "HAT_TRICKS_OFFICIAL"),
    "races led":                   ("racesLed",            "RACES_LED_OFFICIAL"),
    "laps led":                    ("lapsLed",             "LAPS_LED_OFFICIAL"),
    "wins":                        ("wins",                "WINS_OFFICIAL"),
    "win %":                       ("winPercentage",       "WIN_PERCENTAGE_OFFICIAL"),
    "win percentage":              ("winPercentage",       "WIN_PERCENTAGE_OFFICIAL"),
    "wins percentage":             ("winPercentage",       "WIN_PERCENTAGE_OFFICIAL"),
    "wins in a season":            ("bestSeasonWins",      "WINS_BEST_SEASON_OFFICIAL"),
    "most wins in a season":       ("bestSeasonWins",      "WINS_BEST_SEASON_OFFICIAL"),
    "win streak":                  ("winStreak",           "WIN_STREAK_OFFICIAL"),
    "podiums":                     ("podiums",             "PODIUMS_OFFICIAL"),
    "podiums in a season":         ("bestSeasonPodiums",   "PODIUMS_BEST_SEASON_OFFICIAL"),
    "most podiums in a season":    ("bestSeasonPodiums",   "PODIUMS_BEST_SEASON_OFFICIAL"),
    "podium streak":               ("podiumStreak",        "PODIUM_STREAK_OFFICIAL"),
    "pole positions":              ("poles",               "POLES_OFFICIAL"),
    "poles":                       ("poles",               "POLES_OFFICIAL"),
    "pole positions in a season":  ("bestSeasonPoles",     "POLES_BEST_SEASON_OFFICIAL"),
    "most poles in a season":      ("bestSeasonPoles",     "POLES_BEST_SEASON_OFFICIAL"),
    "pole position streak":        ("poleStreak",          "POLE_STREAK_OFFICIAL"),
    "pole streak":                 ("poleStreak",          "POLE_STREAK_OFFICIAL"),
    "fastest laps":                ("fastestLaps",         "FL_OFFICIAL"),
    "consecutive finishes":        ("consecutiveFinishes", "CONSECUTIVE_OFFICIAL"),
    "consecutive starts":          ("consecutiveFinishes", "CONSECUTIVE_OFFICIAL"),
    "dnfs":                        ("dnfs",                "DNFS_OFFICIAL"),
    "dnf":                         ("dnfs",                "DNFS_OFFICIAL"),
    "did not finish":              ("dnfs",                "DNFS_OFFICIAL"),
    "consecutive points":          ("consecutivePoints",   "CONSECUTIVE_POINTS_OFFICIAL"),
    "consecutive points finishes": ("consecutivePoints",   "CONSECUTIVE_POINTS_OFFICIAL"),
}


def dismiss_consent(page):
    for selector in [
        "button:has-text('Consent')",
        "button:has-text('Accept')",
        "#onetrust-accept-btn-handler",
    ]:
        try:
            btn = page.query_selector(selector)
            if btn and btn.is_visible():
                btn.click()
                page.wait_for_timeout(1000)
                return
        except Exception:
            pass


def parse_value(raw: str) -> float | None:
    cleaned = raw.strip().replace(",", "").replace("%", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def extract_leaderboard(page) -> list[dict]:
    """
    Extract (driver, value) from the leaderboard table.
    Table columns: POS | COUNTRY | DRIVER | <value>
    So driver = col[2], value = col[3].
    """
    return page.evaluate(r"""() => {
        const rows = [];
        const trs = document.querySelectorAll('tbody tr');
        for (const tr of trs) {
            const cells = tr.querySelectorAll('td');
            if (cells.length < 4) continue;

            // col 2 = driver name, col 3 = value
            const driver = cells[2].innerText.trim();
            const valueRaw = cells[3].innerText.trim();

            if (!driver || driver.length < 2) continue;

            rows.push({ driver, valueRaw });
        }
        return rows;
    }""")


TAB_SEL      = '[class*="TabTitle"]'
SIDEBAR_SEL  = '[class*="TabMenuItem"]'


def get_tab_texts(page) -> list[str]:
    """
    Read all top-tab labels — including those hidden behind the ellipsis.
    TabTitle elements live inside RecordsTabContainer divs; we grab all of
    them regardless of visibility so we never miss overflow tabs.
    """
    texts = page.evaluate("""() => {
        // Prefer RecordsTabContainer > TabTitle (catches hidden tabs too)
        const containers = document.querySelectorAll('[class*="RecordsTabContainer"]');
        if (containers.length > 0) {
            return [...containers]
                .map(c => c.querySelector('[class*="TabTitle"]'))
                .filter(Boolean)
                .map(el => el.innerText.trim())
                .filter(t => t && t !== '...' && t !== '…');
        }
        // Fallback: any TabTitle
        return [...document.querySelectorAll('[class*="TabTitle"]')]
            .map(e => e.innerText.trim())
            .filter(t => t && t !== '...' && t !== '…');
    }""")
    return texts


def get_sidebar_texts(page) -> list[str]:
    """Read all currently-visible sidebar item labels (fresh query every call)."""
    return page.evaluate(f"""() => {{
        const els = document.querySelectorAll('{SIDEBAR_SEL}');
        return [...els].map(e => e.innerText.trim()).filter(Boolean);
    }}""")


def click_by_text(page, selector: str, text: str) -> bool:
    """
    Click the first element matching selector whose text equals text.
    For TAB_SEL, also searches inside RecordsTabContainer (catches hidden tabs).
    """
    try:
        clicked = page.evaluate(f"""(text) => {{
            // For tab titles: search inside RecordsTabContainer too (catches overflow/hidden tabs)
            const containers = document.querySelectorAll('[class*="RecordsTabContainer"]');
            for (const c of containers) {{
                const el = c.querySelector('[class*="TabTitle"]');
                if (el && el.innerText.trim() === text) {{
                    el.click();
                    return true;
                }}
            }}
            // Generic fallback
            const els = document.querySelectorAll('{selector}');
            for (const el of els) {{
                if (el.innerText.trim() === text) {{
                    el.click();
                    return true;
                }}
            }}
            return false;
        }}""", text)
        return clicked
    except Exception as exc:
        print(f"      ✗ JS click failed: {exc}")
        return False


def is_dropdown_open(page) -> bool:
    """Check whether the sidebar dropdown is currently visible."""
    return page.evaluate(f"""() => {{
        const els = document.querySelectorAll('{SIDEBAR_SEL}');
        for (const el of els) {{
            if (el.offsetWidth > 0 && el.offsetHeight > 0) return true;
        }}
        return false;
    }}""")


def ensure_dropdown_open(page, tab_text):
    """Open the tab dropdown only if it is currently closed (avoids toggling)."""
    if not is_dropdown_open(page):
        click_by_text(page, TAB_SEL, tab_text)
        page.wait_for_timeout(800)


def click_ellipsis(page) -> bool:
    """Click the '...' ellipsis tab container."""
    clicked = page.evaluate("""() => {
        const el = document.querySelector('[class*="EllipsisTabContainer"]');
        if (el) { el.click(); return true; }
        return false;
    }""")
    if clicked:
        page.wait_for_timeout(800)
    return clicked


def get_overflow_tab_texts(page) -> list[str]:
    """
    After clicking the ellipsis, return tab-like items that appeared.
    Tries several strategies to find the dropdown items.
    """
    return page.evaluate("""() => {
        const texts = new Set();

        // Strategy 1: anything inside an Ellipsis/Overflow container
        for (const sel of [
            '[class*="Ellipsis"]', '[class*="ellipsis"]',
            '[class*="Overflow"]', '[class*="overflow"]',
            '[class*="Dropdown"]', '[class*="dropdown"]',
            '[class*="Popover"]', '[class*="popover"]',
            '[class*="Menu"]',
        ]) {
            const containers = document.querySelectorAll(sel);
            for (const c of containers) {
                const items = c.querySelectorAll('a, li, button, [role="menuitem"], [role="option"], span, div');
                for (const el of items) {
                    const t = el.innerText.trim();
                    if (t && t.length > 3 && !/^[.…]+$/.test(t)) texts.add(t);
                }
            }
        }

        // Strategy 2: look at parent of EllipsisTabContainer for siblings
        const ellipsis = document.querySelector('[class*="EllipsisTabContainer"]');
        if (ellipsis) {
            const parent = ellipsis.parentElement;
            if (parent) {
                const items = parent.querySelectorAll('a, li, button, span, div');
                for (const el of items) {
                    const t = el.innerText.trim();
                    if (t && t.length > 3 && !/^[.…]+$/.test(t)) texts.add(t);
                }
            }
        }

        return [...texts];
    }""")


def click_overflow_item(page, text: str) -> bool:
    """Click an item inside the overflow/ellipsis dropdown by text."""
    return page.evaluate("""(text) => {
        const containers = document.querySelectorAll(
            '[class*="Ellipsis"], [class*="ellipsis"], [class*="Overflow"], [class*="overflow"]'
        );
        for (const c of containers) {
            const items = c.querySelectorAll('a, li, button, [role="menuitem"], [role="option"], span');
            for (const el of items) {
                if (el.innerText.trim() === text) { el.click(); return true; }
            }
        }
        return false;
    }""", text)


def scrape_tab_group(page, tab_text, results, meta, *, is_overflow=False):
    """Open a tab (or overflow item) and scrape all its sidebar records."""
    print(f"\n── Tab: [{tab_text}] ──")

    if is_overflow:
        # Re-open ellipsis and click the hidden tab item
        click_ellipsis(page)
        ok = click_overflow_item(page, tab_text)
        if not ok:
            # Try clicking via TabTitle in case it's now promoted to main bar
            ok = click_by_text(page, TAB_SEL, tab_text)
        if not ok:
            print(f"  ✗ Could not click overflow tab '{tab_text}'")
            return
        page.wait_for_timeout(1000)
    else:
        ensure_dropdown_open(page, tab_text)
        if not is_dropdown_open(page):
            click_by_text(page, TAB_SEL, tab_text)
            page.wait_for_timeout(800)

    sidebar_texts = get_sidebar_texts(page)
    print(f"  Sidebar items: {sidebar_texts}")

    if not sidebar_texts:
        mapping = LABEL_TO_CONST.get(tab_text.strip().lower())
        if mapping:
            _scrape_and_store(page, tab_text, mapping, results, meta)
        return

    for sb_text in sidebar_texts:
        mapping = LABEL_TO_CONST.get(sb_text.strip().lower())
        if mapping is None:
            print(f"    [SKIP] '{sb_text}'")
            continue

        print(f"    → '{sb_text}'")

        if is_overflow:
            # Reopen ellipsis dropdown then click sidebar item
            click_ellipsis(page)
            click_overflow_item(page, tab_text)
            page.wait_for_timeout(600)
        else:
            ensure_dropdown_open(page, tab_text)

        ok = click_by_text(page, SIDEBAR_SEL, sb_text)
        if not ok:
            print(f"      ✗ Could not click '{sb_text}'")
            continue
        page.wait_for_timeout(1500)

        _scrape_and_store(page, sb_text, mapping, results, meta)


def scrape_all(page) -> tuple[dict, dict]:
    results: dict[str, dict] = {}
    meta:    dict[str, str]  = {}

    tab_texts = get_tab_texts(page)
    print(f"Top tabs found: {tab_texts}")

    # ── Regular top tabs ──────────────────────────────────────────────────
    for tab_text in tab_texts:
        scrape_tab_group(page, tab_text, results, meta, is_overflow=False)


    return results, meta


def get_page_count(page) -> int:
    """Read the total page count from the PagesCount span, e.g. '1 of 21' → 21."""
    text = page.evaluate("""() => {
        const el = document.querySelector('[class*="PagesCount"]');
        return el ? el.innerText.trim() : '';
    }""")
    m = re.search(r'of\s+(\d+)', text)
    return int(m.group(1)) if m else 1


def set_page_size_100(page):
    """Set the per-page SELECT to 100 to minimise the number of pagination clicks."""
    page.evaluate("""() => {
        const sel = document.querySelector('[class*="ItemsAtPage"]');
        if (!sel) return;
        sel.value = '100';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
    }""")


def goto_page(page, n: int) -> bool:
    """Navigate to page n using the go-to input + GO button. Returns True on success."""
    return page.evaluate("""(n) => {
        // Find the numeric input inside the PaginationContainer
        const container = document.querySelector('[class*="PaginationContainer"]');
        if (!container) return false;
        const input = container.querySelector('input[type="number"], input[type="text"], input');
        const goBtn = document.querySelector('[class*="GoBtn"], [class*="SubmenuGoBtn"]');
        if (!input || !goBtn) return false;

        // Set value and fire events so React picks it up
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
        ).set;
        nativeInputValueSetter.call(input, String(n));
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        goBtn.click();
        return true;
    }""", n)


def _scrape_and_store(page, label, mapping, results, meta):
    key, js_const = mapping

    if key not in results:
        results[key] = {}
        meta[key] = js_const

    # Set 100 items per page to reduce pagination clicks, then read total pages
    set_page_size_100(page)
    page.wait_for_timeout(1000)
    total_pages = get_page_count(page)

    for page_num in range(1, total_pages + 1):
        if page_num > 1:
            ok = goto_page(page, page_num)
            if not ok:
                print(f"      ⚠ Could not navigate to page {page_num}")
                break
            page.wait_for_timeout(1200)

        raw_rows = extract_leaderboard(page)
        if not raw_rows:
            if page_num == 1:
                print(f"      ⚠ No rows extracted for '{label}'")
            break

        for r in raw_rows:
            v = parse_value(r["valueRaw"])
            if v is None:
                continue
            d = r["driver"]
            if d not in results[key] or v > results[key][d]:
                results[key][d] = v

    pages_str = f" ({total_pages} pages)" if total_pages > 1 else ""
    top = sorted(results[key].items(), key=lambda x: -x[1])[:3]
    preview = ", ".join(f"{d}: {v}" for d, v in top)
    print(f"      ✓ {len(results[key])} drivers{pages_str} — top 3: {preview}")


def format_js(all_results: dict, meta: dict) -> str:
    lines = [
        "// ── AUTO-GENERATED by tools/scraper/scrape_records.py ──",
        f"// Source: {BASE_URL}",
        f"// Generated: {datetime.utcnow().isoformat()}Z",
        "",
    ]
    for key, data in all_results.items():
        js_const = meta.get(key, key.upper() + "_OFFICIAL")
        sorted_entries = sorted(data.items(), key=lambda x: -x[1])
        lines.append(f"const {js_const} = {{")
        for i in range(0, len(sorted_entries), 4):
            chunk = sorted_entries[i:i + 4]
            parts = [
                f"'{d}': {int(v) if v == int(v) else v}"
                for d, v in chunk
            ]
            lines.append("  " + ", ".join(parts) + ",")
        lines.append("};")
        lines.append("")
    return "\n".join(lines)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=False, slow_mo=100)
        ctx = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 2200, "height": 900},
        )
        page = ctx.new_page()

        print(f"Opening: {BASE_URL}")
        try:
            page.goto(BASE_URL, wait_until="networkidle", timeout=40_000)
        except PWTimeout:
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=40_000)
            page.wait_for_timeout(4000)

        page.wait_for_timeout(2000)
        dismiss_consent(page)
        page.wait_for_timeout(1000)

        all_results, meta = scrape_all(page)
        browser.close()

    # ── Outputs ────────────────────────────────────────────────────────────
    json_path = OUT_DIR / "records.json"
    js_path   = OUT_DIR / "records.js"

    with open(json_path, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\n✓ JSON → {json_path}")

    with open(js_path, "w") as f:
        f.write(format_js(all_results, meta))
    print(f"✓ JS   → {js_path}")

    print("\n── SUMMARY ──────────────────────────────────────────────")
    for key, data in all_results.items():
        print(f"  {'✓' if data else '✗'}  {key:<28}  {len(data)} drivers")

    expected = {m[0] for m in LABEL_TO_CONST.values()}
    missing  = expected - set(all_results.keys())
    if missing:
        print(f"\n⚠ Not scraped: {', '.join(sorted(missing))}")

    print(f"\nReview {js_path} then paste into src/assets/seasonData.js")


if __name__ == "__main__":
    main()
