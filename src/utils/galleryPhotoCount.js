// Formats a gallery album's photo count for display. Shared by GalleryTab.js
// (album tile) and GalleryAlbumScreen.js (header) so the two never drift.
//
// totalCount is an ESTIMATE while an album is still mid-capture (extrapolated
// from the first scraped page's photo count x total page count - see
// scrape_gallery.py) - showing it alone ("120 photos") reads as "120 are
// available now", when only capturedCount actually are. Root-caused live
// 2026-08-28: a user correctly counted exactly capturedCount photos on
// screen, but the header showed the (much larger) estimated eventual total
// with nothing indicating only a subset had been captured so far. Once
// complete, capturedCount === totalCount exactly (no longer an estimate),
// so the plain form is accurate and simpler.
export function formatPhotoCount({capturedCount, totalCount, complete}) {
  const plural = (n) => `photo${n === 1 ? '' : 's'}`;
  if (complete) {
    return `${totalCount} ${plural(totalCount)}`;
  }
  return `${capturedCount} of ~${totalCount} ${plural(totalCount)} · more being added`;
}
