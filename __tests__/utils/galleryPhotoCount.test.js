import {formatPhotoCount} from '../../src/utils/galleryPhotoCount';

describe('formatPhotoCount', () => {
  it('shows the plain total once an album is complete', () => {
    expect(formatPhotoCount({capturedCount: 24, totalCount: 24, complete: true})).toBe('24 photos');
  });

  it('uses singular "photo" for a count of exactly 1', () => {
    expect(formatPhotoCount({capturedCount: 1, totalCount: 1, complete: true})).toBe('1 photo');
  });

  it('shows "captured of ~estimated" with a "more being added" note while incomplete', () => {
    // Root-caused live 2026-08-28: showing only the estimated total ("120
    // photos") while an album was still mid-capture read as "120 are
    // available now" - a user correctly counted the real 24 on screen and
    // (reasonably) assumed the mismatch was a bug. Locks in the fixed copy.
    expect(formatPhotoCount({capturedCount: 24, totalCount: 120, complete: false}))
      .toBe('24 of ~120 photos · more being added');
  });
});
