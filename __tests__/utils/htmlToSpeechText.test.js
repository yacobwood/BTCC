import {htmlToSpeechText} from '../../src/utils/htmlToSpeechText';

describe('htmlToSpeechText', () => {
  it('returns an empty string for empty/null input', () => {
    expect(htmlToSpeechText('')).toBe('');
    expect(htmlToSpeechText(null)).toBe('');
    expect(htmlToSpeechText(undefined)).toBe('');
  });

  it('strips tags from a plain paragraph and keeps the text', () => {
    expect(htmlToSpeechText('<p>Hello world.</p>')).toBe('Hello world.');
  });

  it('adds a period to a block that has none, so chunks read as sentences', () => {
    expect(htmlToSpeechText('<h2>No punctuation here</h2>')).toBe('No punctuation here.');
  });

  it('keeps existing terminal punctuation instead of doubling it', () => {
    expect(htmlToSpeechText('<p>Already a question?</p>')).toBe('Already a question?');
  });

  it('joins multiple paragraphs with a space, each ending in its own full stop', () => {
    const html = '<p>First paragraph</p><p>Second paragraph</p>';
    expect(htmlToSpeechText(html)).toBe('First paragraph. Second paragraph.');
  });

  it('reads a bullet list as one sentence per item', () => {
    const html = '<ul><li>One</li><li>Two</li><li>Three</li></ul>';
    expect(htmlToSpeechText(html)).toBe('One. Two. Three.');
  });

  it('reads a numbered step list the same way as a bullet list', () => {
    const html = '<ol class="steps"><li>First step</li><li>Second step</li></ol>';
    expect(htmlToSpeechText(html)).toBe('First step. Second step.');
  });

  it('reads a blockquote as a normal sentence', () => {
    expect(htmlToSpeechText('<blockquote>A key takeaway.</blockquote>')).toBe('A key takeaway.');
  });

  it('strips inline formatting tags but keeps their text', () => {
    expect(htmlToSpeechText('<p>Some <strong>bold</strong> and <em>italic</em> text.</p>')).toBe('Some bold and italic text.');
  });

  it('decodes common HTML entities', () => {
    expect(htmlToSpeechText('<p>Fish &amp; chips &mdash; a driver&#39;s favourite.</p>')).toBe("Fish & chips - a driver's favourite.");
  });

  it('collapses repeated internal whitespace within a line', () => {
    expect(htmlToSpeechText('<p>Line   with    extra   spaces</p>')).toBe('Line with extra spaces.');
  });

  it('treats an embedded newline inside a tag as its own sentence break', () => {
    // Real content from this app's own pipeline never embeds a raw newline
    // inside a single <p> (every article writes one paragraph per line - see
    // build_explainer_articles.py), but scraped btcc.net HTML can be looser.
    // Splitting on it gives a natural pause rather than running two
    // unrelated lines together with no punctuation between them.
    expect(htmlToSpeechText('<p>Line one\nLine two</p>')).toBe('Line one. Line two.');
  });

  it('converts a table into a lead-in sentence plus one restated-header sentence per row', () => {
    const html = '<div class="table-wrap"><table><thead><tr><th>Position</th><th>Points</th></tr></thead>' +
      '<tbody><tr><td>1st</td><td>20</td></tr><tr><td>2nd</td><td>17</td></tr></tbody></table></div>';
    expect(htmlToSpeechText(html)).toBe(
      'Here is a breakdown by Position, Points. Position: 1st. Points: 20. Position: 2nd. Points: 17.',
    );
  });

  it('skips an empty table (header row only, no body) without crashing', () => {
    const html = '<div class="table-wrap"><table><thead><tr><th>Position</th><th>Points</th></tr></thead><tbody></tbody></table></div>';
    expect(htmlToSpeechText(html)).toBe('');
  });

  it('handles a full article shape end to end: heading, paragraph, table, list, blockquote', () => {
    const html =
      '<p>Intro paragraph.</p>' +
      '<h2>A Heading</h2>' +
      '<p>More detail here.</p>' +
      '<div class="table-wrap"><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></div>' +
      '<ul><li>Bullet one</li></ul>' +
      '<blockquote>The key point.</blockquote>';
    const result = htmlToSpeechText(html);
    expect(result).toContain('Intro paragraph.');
    expect(result).toContain('A Heading.');
    expect(result).toContain('More detail here.');
    expect(result).toContain('Here is a breakdown by A, B.');
    expect(result).toContain('A: 1. B: 2.');
    expect(result).toContain('Bullet one.');
    expect(result).toContain('The key point.');
  });
});
