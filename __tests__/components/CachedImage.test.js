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

// CachedImage renders <Image source={{uri}} onError={...}>
// We identify it by type and the presence of a uri source prop.
function findCachedImgNode(json) {
  if (!json) return null;
  if (json.type === 'Image' && json.props?.source?.uri) return json;
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
  it('renders an Image with the given uri', () => {
    const tree = render(<CachedImage uri={WP_URI} style={{width: 100, height: 100}} />);
    const node = getCachedImg(tree);
    expect(node).toBeTruthy();
    expect(node.props.source.uri).toBe(WP_URI);
    expect(node.props.source.cache).toBeUndefined();
  });

  it('does not include cache property on source (removed to prevent Android image reload)', () => {
    const tree = render(<CachedImage uri={WP_URI} style={{width: 100, height: 100}} />);
    const node = getCachedImg(tree);
    expect(node.props.source).not.toHaveProperty('cache');
  });

  it('source object reference is stable across re-renders when uri unchanged', () => {
    // A parent with changing state forces CachedImage to re-render without any of its
    // own props changing. On Android, a new source object reference triggers a full
    // image reload cycle even when the URI is identical — this test catches that regression.
    function Wrapper({count}) {
      return <CachedImage uri={WP_URI} style={{width: 100}} />;
    }
    const {rerender, UNSAFE_getAllByType} = render(<Wrapper count={0} />);
    const source1 = UNSAFE_getAllByType(Image)[0].props.source;

    rerender(<Wrapper count={1} />);
    const source2 = UNSAFE_getAllByType(Image)[0].props.source;

    expect(source1).toBe(source2);
  });

  it('recovers when a recycled instance is given a new uri after a previous error', () => {
    // FlatList/PagerView reuse component instances across list items rather than
    // remounting - a single dead image anywhere must not permanently poison every
    // later item recycled into that same instance.
    const tree = render(<CachedImage uri={EXT_URI} style={{width: 100, height: 100}} />);
    for (let i = 0; i < 6; i++) { // MAX_RETRIES (5) tolerated, 6th exhausts it
      act(() => { getCachedImg(tree).props.onError(); });
    }
    expect(getCachedImg(tree)).toBeNull(); // errored = true

    tree.rerender(<CachedImage uri="https://example.com/a-different-valid-image.jpg" style={{width: 100, height: 100}} />);
    const node = getCachedImg(tree);
    expect(node).toBeTruthy();
    expect(node.props.source.uri).toBe('https://example.com/a-different-valid-image.jpg');
  });

  it('shows the fallback (no image element) when uri is null', () => {
    const tree = render(<CachedImage uri={null} style={{width: 100, height: 100}} />);
    expect(getCachedImg(tree)).toBeNull();
  });

  it('renders a custom `fallback` node instead of the default icon once retries are exhausted', () => {
    const {Text} = require('react-native');
    const tree = render(
      <CachedImage uri={EXT_URI} style={{width: 100, height: 100}} fallback={<Text>custom fallback</Text>} />,
    );
    // MAX_RETRIES (5) tolerated errors, the 6th exhausts the budget.
    for (let i = 0; i < 6; i++) {
      act(() => { getCachedImg(tree).props.onError(); });
    }
    expect(getCachedImg(tree)).toBeNull();
    expect(tree.getByText('custom fallback')).toBeTruthy();
  });

  it('renders a custom `fallback` node when uri is null', () => {
    const {Text} = require('react-native');
    const tree = render(<CachedImage uri={null} style={{width: 100, height: 100}} fallback={<Text>custom fallback</Text>} />);
    expect(tree.getByText('custom fallback')).toBeTruthy();
  });

  it('retries up to MAX_RETRIES times before showing the fallback', () => {
    const tree = render(<CachedImage uri={WP_URI} style={{width: 100, height: 100}} />);
    // src === uri (no targetWidth): the first MAX_RETRIES (5) errors are
    // tolerated as retries (a cell recycling mid-request looks identical to a
    // real failure, so a lone error shouldn't immediately give up, and a big
    // non-virtualized grid - see DriversScreen.js's car badge - can genuinely
    // need several attempts to get a turn) and the Image stays mounted.
    for (let i = 0; i < 5; i++) {
      act(() => { getCachedImg(tree).props.onError(); });
      expect(getCachedImg(tree)).toBeTruthy();
    }
    // 6th error exhausts MAX_RETRIES (5) → errored = true → fallback renders
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

  it('shows fallback after exhausting retries on the original uri (thumbnail also 404s)', () => {
    const tree = render(
      <CachedImage uri={WP_URI} style={{width: 100, height: 100}} targetWidth={200} />,
    );
    act(() => { getCachedImg(tree).props.onError(); }); // thumb → original (not a retry)
    for (let i = 0; i < 5; i++) {
      act(() => { getCachedImg(tree).props.onError(); }); // retries 1-5 (MAX_RETRIES)
    }
    expect(getCachedImg(tree)).toBeTruthy(); // still retrying on the original uri
    act(() => { getCachedImg(tree).props.onError(); }); // retries exhausted → errored = true
    expect(getCachedImg(tree)).toBeNull();
  });

  it('schedules each retry with a backoff delay instead of retrying immediately', () => {
    // Root-caused live 2026-08-19: a screen mounting many CachedImages at
    // once (the Teams grid, ~20 requests together) saw a few fail in
    // rotation on otherwise-correct URLs - retrying the instant an image
    // errors just re-hits the same request burst. Confirms a real delay is
    // scheduled rather than retryCount being bumped synchronously.
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const tree = render(<CachedImage uri={EXT_URI} style={{width: 100, height: 100}} />);
    act(() => { getCachedImg(tree).props.onError(); });
    expect(setTimeoutSpy).toHaveBeenCalled();
    const delay = setTimeoutSpy.mock.calls[setTimeoutSpy.mock.calls.length - 1][1];
    expect(delay).toBeGreaterThan(0);
    setTimeoutSpy.mockRestore();
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
