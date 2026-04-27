#!/usr/bin/env node
/**
 * Scrapes Independents Trophy driver lists from Wikipedia for each BTCC season
 * and writes cls: 'I' / cls: 'M' into the bundled season JSON files.
 *
 * Usage:  node scripts/scrapeClasses.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '../src/assets/data');
const YEARS = Array.from({length: 2025 - 2004 + 1}, (_, i) => 2004 + i);

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {headers: {'User-Agent': 'Mozilla/5.0 (compatible; BTCC-app-scraper/1.0)'}}, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function norm(s) {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

/** Extract Independents Trophy driver names from a Wikipedia season page HTML */
function extractIndependents(html) {
  // Find section heading containing "independen"
  const headingRe = /<h[23][^>]*>.*?independen.*?<\/h[23]>/gi;
  const match = headingRe.exec(html);
  if (!match) return null;

  // Grab all HTML after that heading
  const after = html.slice(match.index + match[0].length);

  // Find first <table> in that section, tracking depth for nested tables
  const tableStart = after.indexOf('<table');
  if (tableStart === -1) return null;
  let depth = 0;
  let pos = tableStart;
  let tableEnd = -1;
  while (pos < after.length) {
    const nextOpen = after.indexOf('<table', pos + 1);
    const nextClose = after.indexOf('</table>', pos);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen;
    } else {
      if (depth === 0) { tableEnd = nextClose; break; }
      depth--;
      pos = nextClose;
    }
  }
  if (tableEnd === -1) return null;
  const table = after.slice(tableStart, tableEnd + 8);

  // Extract last <a> text from each cell, skipping flag/country links
  function extractDriverFromCell(cell) {
    const linkRe = /<a[^>]+href="\/wiki\/([^"]+)"[^>]*>([^<]+)<\/a>/g;
    let lm, lastName = null;
    while ((lm = linkRe.exec(cell)) !== null) {
      const href = lm[1];
      const text = lm[2].trim();
      // Skip flag/country links (href contains country names, or text is a country)
      if (/United_Kingdom|Scotland|England|Ireland|Wales|Australia|New_Zealand|Germany|France|Belgium|Netherlands|Sweden|Finland|Norway|Denmark|Italy|Spain|Portugal|Switzerland|Austria|Canada|United_States|Japan/i.test(href)) continue;
      lastName = text;
    }
    return lastName;
  }

  const names = [];

  // Primary: <td align="left"> cells (full race-result tables)
  const rowRe = /<td[^>]*align="left"[^>]*>([\s\S]*?)<\/td>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(table)) !== null) {
    const name = extractDriverFromCell(rowMatch[1]);
    if (name && !names.includes(norm(name))) names.push(norm(name));
  }

  // Fallback: simple 3-column table — plain <td> cells with a wiki person link
  if (names.length === 0) {
    const tdRe = /<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/gi;
    while ((rowMatch = tdRe.exec(table)) !== null) {
      const name = extractDriverFromCell(rowMatch[1]);
      if (name && !names.includes(norm(name))) names.push(norm(name));
    }
  }

  return names.length > 0 ? names : null;
}

/** Fuzzy match: exact norm match, or our name contains wiki name or vice versa */
function isIndependent(driverName, independentsList) {
  const n = norm(driverName);
  return independentsList.some(ind => n === ind || n.includes(ind) || ind.includes(n));
}

async function main() {
  let totalUpdated = 0;

  for (const year of YEARS) {
    const file = path.join(DATA_DIR, `season_${year}.json`);
    if (!fs.existsSync(file)) {
      console.log(`  [${year}] No JSON file — skipping`);
      continue;
    }

    const url = `https://en.wikipedia.org/wiki/${year}_British_Touring_Car_Championship`;
    process.stdout.write(`[${year}] Fetching Wikipedia...`);

    let html;
    try {
      html = await fetch(url);
    } catch (e) {
      console.log(` FETCH ERROR: ${e.message}`);
      continue;
    }

    const independents = extractIndependents(html);
    if (!independents) {
      console.log(` ⚠  No Independents table found`);
      continue;
    }

    console.log(` found ${independents.length} independents`);

    const season = JSON.parse(fs.readFileSync(file, 'utf8'));
    let matched = 0;
    let unmatched = [];

    season.drivers = season.drivers.map(d => {
      const isI = isIndependent(d.name, independents);
      if (isI) matched++;
      else if (d.cls === 'I') unmatched.push(d.name); // was I, now not found
      return {...d, cls: isI ? 'I' : 'M'};
    });

    // Report any independents from Wikipedia not found in our JSON
    const ourNames = season.drivers.map(d => norm(d.name));
    const notInOurs = independents.filter(ind => !ourNames.some(n => n === ind || n.includes(ind) || ind.includes(n)));
    if (notInOurs.length) {
      console.log(`   ⚠  Wikipedia independents not in our JSON: ${notInOurs.join(', ')}`);
    }

    console.log(`   → ${matched} I  /  ${season.drivers.length - matched} M`);
    fs.writeFileSync(file, JSON.stringify(season, null, 2));
    totalUpdated++;

    // Polite delay between requests
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nDone — updated ${totalUpdated} season files.`);
}

main().catch(err => { console.error(err); process.exit(1); });
