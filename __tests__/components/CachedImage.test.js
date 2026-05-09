// Override the global jest.setup.js stub so we test the real component
jest.mock('../../src/components/CachedImage', () =>
  jest.requireActual('../../src/components/CachedImage'),
);

import React from 'react';
import {Image} from 'react-native';
import {act, render} from '@testing-library/react-native';
import CachedImage, {prefetchImages} from '../../src/components/CachedImage';

const WP_URI  = 'https://www.btcc.net/wp-content/uploads/2026/photo.jpg';
const EXT_URI = 'https://example.com/image.jpg';

// CachedImage renders <Image source={{uri, cache:'force-cache'}} onError={...}>
// We identify it by the unique cache:'force-cache' prop in the JSON tree.
function findCachedImgNode(json) {
  if (!json) return null;
  if (json.type === 'Image' && json.props?.source?.cache === 'force-cache') return json;
  for (const child of json.children || []) {
    const found = findCachedImgNode(child);
    if (found) return found;
  }
  return null;
}

function getCachedImg({toJSON}) {
  return findCachedImgNode(toJSON());
}

describe('CachedImage', () => {
  it('renders an Image with force-cache and the given uri', () => {
    const tree = render(<CachedImage uri={WP_URI} style={{width: 100, height: 100}} />);
    const node = getCachedImg(tree);
    expect(node).toBeTruthy();
    expect(node.props.source.uri).toBe(WP_URI);
    expect(node.props.source.cache).toBe('force-cache');
  });

  it('shows the fallback (no image element) when uri is null', () => {
    const tree = render(<CachedImage uri={null} style={{width: 100, height: 100}} />);
    expect(getCachedImg(tree)).toBeNull();
  });

  it('shows the fallback after an image load error', () => {
    const tree = render(<CachedImage uri={WP_URI} style={{width: 100, height: 100}} />);
    // src === uri (no targetWidth) → onError sets errored = true → fallback renders
    act(() => { getCachedImg(tree).props.onError(); });
    expect(getCachedImg(tree)).toBeNull();
  });

  it('selects the smallest adequate WP thumbnail when targetWidth is given', () => {
    const tree = render(
      <CachedImage uri={WP_URI} style={{width: 100, height: 100}} targetWidth={200} />,
    );
    const node = getCachedImg(tree);
    // 200px → smallest WP size >= 200 is 300
    expect(node.props.source.uri).toContain('-300x300');
  });

  it('selects the 768 thumbnail for a 400px target', () => {
    const tree = render(
      <CachedImage uri={WP_URI} style={{width: 100, height: 100}} targetWidth={400} />,
    );
    expect(getCachedImg(tree).props.source.uri).toContain('-768x768');
  });

  it('falls back to original uri when thumbnail 404s', () => {
    const tree = render(
      <CachedImage uri={WP_URI} style={{width: 100, height: 100}} targetWidth={200} />,
    );
    // First error: src is the thumb url (different from uri) → set src = uri
    act(() => { getCachedImg(tree).props.onError(); });
    expect(getCachedImg(tree).props.source.uri).toBe(WP_URI);
  });

  it('shows fallback after second error (original uri 404)', () => {
    const tree = render(
      <CachedImage uri={WP_URI} style={{width: 100, height: 100}} targetWidth={200} />,
    );
    act(() => { getCachedImg(tree).props.onError(); }); // thumb → original
    act(() => { getCachedImg(tree).props.onError(); }); // original → errored = true
    expect(getCachedImg(tree)).toBeNull();
  });

  it('does not transform non-WP uris', () => {
    const tree = render(
      <CachedImage uri={EXT_URI} style={{width: 100, height: 100}} targetWidth={100} />,
    );
    expect(getCachedImg(tree).props.source.uri).toBe(EXT_URI);
  });
});

// ─── prefetchImages ───────────────────────────────────────────────────────────

describe('prefetchImages', () => {
  beforeEach(() => {
    Image.prefetch = jest.fn().mockResolvedValue(true);
  });

  it('calls Image.prefetch for each non-null url', () => {
    prefetchImages(['https://a.com/1.jpg', 'https://a.com/2.jpg']);
    expect(Image.prefetch).toHaveBeenCalledTimes(2);
    expect(Image.prefetch).toHaveBeenCalledWith('https://a.com/1.jpg');
    expect(Image.prefetch).toHaveBeenCalledWith('https://a.com/2.jpg');
  });

  it('skips null/falsy urls', () => {
    prefetchImages([null, '', 'https://a.com/valid.jpg']);
    expect(Image.prefetch).toHaveBeenCalledTimes(1);
    expect(Image.prefetch).toHaveBeenCalledWith('https://a.com/valid.jpg');
  });

  it('does not throw when Image.prefetch rejects (404 silenced)', async () => {
    Image.prefetch = jest.fn().mockRejectedValue(new Error('404 Not Found'));
    await expect(
      Promise.resolve().then(() => prefetchImages(['https://a.com/missing.jpg'])),
    ).resolves.not.toThrow();
  });
});
