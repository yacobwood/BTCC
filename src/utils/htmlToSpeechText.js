// Converts an article's HTML body (as rendered by ArticleScreen's buildHtml -
// see src/screens/ArticleScreen.js) into plain, speech-friendly text for the
// in-app read-aloud feature. A table is the one thing that reads as
// gibberish if just tag-stripped: a screen reader either reads the raw
// markup aloud or runs every cell into one unbroken string with no sense of
// which value belongs to which column. tableToSpeech() below solves that the
// same way the BTCC-Explained-All-Articles.md reader-doc build script does -
// restating both column headers on every row - see the "collate all
// articles" work this session for the original version of this problem.

const ENTITY_MAP = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&nbsp;': ' ', '&mdash;': ' - ', '&ndash;': '-', '&hellip;': '...',
};

function decodeEntities(text) {
  return text.replace(/&[a-z#0-9]+;/gi, (m) => ENTITY_MAP[m] ?? m);
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function ensureSentenceEnd(text) {
  const t = text.trim();
  if (!t) return '';
  return /[.!?:]$/.test(t) ? t : `${t}.`;
}

function tableToSpeech(tableHtml) {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => m[1]);
  if (!rows.length) return '';
  const cellsOf = (row) => [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(m => stripTags(m[1]));
  const header = cellsOf(rows[0]);
  const body = rows.slice(1).map(cellsOf).filter(r => r.length);
  if (!header.length || !body.length) return '';

  const sentences = [`Here is a breakdown by ${header.join(', ')}.`];
  for (const row of body) {
    const pairs = header
      .map((h, i) => (row[i] !== undefined && row[i] !== '' ? `${h}: ${row[i]}.` : ''))
      .filter(Boolean);
    if (pairs.length) sentences.push(pairs.join(' '));
  }
  return sentences.join(' ');
}

// Block-level tags whose closing tag should force a pause (rendered as a
// paragraph break) rather than running straight into whatever follows.
const BLOCK_CLOSE_RE = /<\/(p|h1|h2|h3|li|blockquote|div|tr)>/gi;

export function htmlToSpeechText(html) {
  if (!html) return '';
  let text = html;

  // Tables first, while their <tr>/<td> structure is still intact - the
  // generic block-close pass below would otherwise just insert a line break
  // after every <tr>, leaving every cell's plain text run together with no
  // indication of which column it came from.
  text = text.replace(/<div class="table-wrap">([\s\S]*?)<\/div>/gi, (_, inner) => ` ${tableToSpeech(inner)} `);

  text = text.replace(BLOCK_CLOSE_RE, '$&\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Everything else (ul/ol wrappers, strong/em/a inline tags, stray divs)
  // just loses its markup - the text inside stays, unformatted, which is
  // exactly right for audio.
  text = text.replace(/<[^>]+>/g, '');
  text = decodeEntities(text);

  return text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(ensureSentenceEnd)
    .join(' ');
}
