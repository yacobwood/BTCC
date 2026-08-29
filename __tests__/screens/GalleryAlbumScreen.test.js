import React from 'react';
import {waitFor, fireEvent} from '@testing-library/react-native';
import GalleryAlbumScreen, {getItemLayout} from '../../src/screens/GalleryAlbumScreen';
import {renderWithProviders, makeNav, makeRoute} from './testUtils';

jest.mock('../../src/api/client', () => ({
  fetchGalleryAlbum: jest.fn(),
}));
jest.mock('../../src/api/parsers', () => ({
  parseGalleryAlbum: jest.fn(json => json),
}));
jest.mock('../../src/utils/analytics', () => ({
  Analytics: {
    screen: jest.fn(),
    galleryAlbumViewed: jest.fn(),
    galleryAlbumLoadFailed: jest.fn(),
    galleryPhotoView: jest.fn(),
    galleryLightboxClosed: jest.fn(),
    pullToRefresh: jest.fn(),
    retryClicked: jest.fn(),
  },
}));
jest.mock('../../src/utils/appShare', () => ({
  shareContent: jest.fn(),
}));
// PhotoLightbox is exercised by its own test file - stub here so this file's
// tests stay focused on the album screen's own loading/grid/analytics wiring.
// Forwards initialIndex/onShare too (not just visible/photos) so this file
// can still test that the screen wires onShare correctly, without needing
// PhotoLightbox's own real pager/gesture machinery.
jest.mock('../../src/components/PhotoLightbox', () => ({
  __esModule: true,
  default: ({visible, photos, initialIndex, onShare}) => {
    const React = require('react');
    const {Text, TouchableOpacity} = require('react-native');
    if (!visible) return null;
    return React.createElement(React.Fragment, null,
      React.createElement(Text, null, `lightbox open: ${photos.length} photos`),
      onShare && React.createElement(
        TouchableOpacity,
        {onPress: () => onShare(initialIndex), accessibilityLabel: 'Share photo'},
        React.createElement(Text, null, 'Share'),
      ),
    );
  },
}));

const {fetchGalleryAlbum} = require('../../src/api/client');
const {Analytics} = require('../../src/utils/analytics');
const {shareContent} = require('../../src/utils/appShare');

const ALBUM = {
  slug: 'donington-park-gallery',
  title: 'Donington Park',
  year: 2026,
  round: 1,
  venue: 'Donington Park',
  capturedCount: 2,
  totalCount: 2,
  complete: true,
  photos: [
    {thumbUrl: 'https://example.com/thumb1.jpg', viewUrl: 'https://example.com/view1.jpg'},
    {thumbUrl: 'https://example.com/thumb2.jpg', viewUrl: 'https://example.com/view2.jpg'},
  ],
};

function renderScreen(nav = makeNav()) {
  const route = makeRoute({season: 2026, albumSlug: 'donington-park-gallery'});
  return renderWithProviders(<GalleryAlbumScreen navigation={nav} route={route} />);
}

describe('GalleryAlbumScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls Analytics.screen("gallery_album") and galleryAlbumViewed on mount', async () => {
    fetchGalleryAlbum.mockResolvedValue(ALBUM);
    renderScreen();
    await waitFor(() => expect(Analytics.screen).toHaveBeenCalledWith('gallery_album'));
    expect(Analytics.galleryAlbumViewed).toHaveBeenCalledWith(2026, 'donington-park-gallery');
  });

  it('renders the album title and photo count once loaded', async () => {
    fetchGalleryAlbum.mockResolvedValue(ALBUM);
    const {getByText} = renderScreen();
    await waitFor(() => expect(getByText('Donington Park')).toBeTruthy());
    expect(getByText('2 photos')).toBeTruthy();
  });

  it('shows a "more being added" note when the album is not yet complete', async () => {
    fetchGalleryAlbum.mockResolvedValue({...ALBUM, complete: false});
    const {getByText} = renderScreen();
    await waitFor(() => expect(getByText(/more being added/)).toBeTruthy());
  });

  it('opens the lightbox and fires galleryPhotoView when a thumbnail is pressed', async () => {
    fetchGalleryAlbum.mockResolvedValue(ALBUM);
    const {getByLabelText, getByText} = renderScreen();
    await waitFor(() => expect(getByLabelText('Photo 1 of 2')).toBeTruthy());
    fireEvent.press(getByLabelText('Photo 1 of 2'));
    expect(Analytics.galleryPhotoView).toHaveBeenCalledWith(2026, 'donington-park-gallery', 0);
    expect(getByText('lightbox open: 2 photos')).toBeTruthy();
  });

  it('calls navigation.goBack when the back button is pressed', async () => {
    fetchGalleryAlbum.mockResolvedValue(ALBUM);
    const nav = makeNav();
    const {getByLabelText} = renderScreen(nav);
    await waitFor(() => expect(getByLabelText('Go back')).toBeTruthy());
    fireEvent.press(getByLabelText('Go back'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  it('shows a retry button and fires galleryAlbumLoadFailed on fetch failure', async () => {
    fetchGalleryAlbum.mockRejectedValue(new Error('network down'));
    const {getByText, getByLabelText} = renderScreen();
    await waitFor(() => expect(getByText("Couldn't load this album")).toBeTruthy());
    expect(Analytics.galleryAlbumLoadFailed).toHaveBeenCalledWith(2026, 'donington-park-gallery', 'network down');
    fetchGalleryAlbum.mockResolvedValue(ALBUM);
    fireEvent.press(getByLabelText('Retry'));
    expect(Analytics.retryClicked).toHaveBeenCalledWith('gallery_album');
    await waitFor(() => expect(getByText('Donington Park')).toBeTruthy());
  });

  it('calls fetchGalleryAlbum with forceRefresh on pull-to-refresh', async () => {
    fetchGalleryAlbum.mockResolvedValue(ALBUM);
    const {getByText, UNSAFE_getByType} = renderScreen();
    await waitFor(() => expect(getByText('Donington Park')).toBeTruthy());
    const {FlatList} = require('react-native');
    const list = UNSAFE_getByType(FlatList);
    list.props.refreshControl.props.onRefresh();
    expect(Analytics.pullToRefresh).toHaveBeenCalledWith('gallery_album');
    await waitFor(() => expect(fetchGalleryAlbum).toHaveBeenLastCalledWith(2026, 'donington-park-gallery', true));
  });

  it('calls shareContent with a gallery link when the lightbox share button fires', async () => {
    fetchGalleryAlbum.mockResolvedValue(ALBUM);
    const {getByLabelText, getByText} = renderScreen();
    await waitFor(() => expect(getByText('Donington Park')).toBeTruthy());
    fireEvent.press(getByLabelText('Photo 1 of 2'));
    fireEvent.press(getByLabelText('Share photo'));
    expect(shareContent).toHaveBeenCalledWith(
      'gallery_photo',
      'donington-park-gallery:0',
      expect.stringContaining('https://btcchub.vercel.app/gallery/2026/donington-park-gallery/0?src=gallery_photo'),
    );
  });

  it('auto-opens the lightbox at route.params.photoIndex once the album loads (deep link)', async () => {
    fetchGalleryAlbum.mockResolvedValue(ALBUM);
    const route = makeRoute({season: 2026, albumSlug: 'donington-park-gallery', photoIndex: '1'});
    const {getByText} = renderWithProviders(<GalleryAlbumScreen navigation={makeNav()} route={route} />);
    await waitFor(() => expect(getByText('lightbox open: 2 photos')).toBeTruthy());
    expect(Analytics.galleryPhotoView).toHaveBeenCalledWith(2026, 'donington-park-gallery', 1);
  });

  it('ignores an out-of-range photoIndex from a deep link rather than guessing', async () => {
    fetchGalleryAlbum.mockResolvedValue(ALBUM);
    const route = makeRoute({season: 2026, albumSlug: 'donington-park-gallery', photoIndex: '99'});
    const {getByText, queryByText} = renderWithProviders(<GalleryAlbumScreen navigation={makeNav()} route={route} />);
    await waitFor(() => expect(getByText('Donington Park')).toBeTruthy());
    expect(queryByText(/lightbox open/)).toBeNull();
  });

  it('passes getItemLayout to the FlatList so a large album never has to progressively measure rows', async () => {
    // Root-caused live 2026-08-28: without this, a 170-photo album (Donington
    // Park) showed the "Photos: btcc.net" footer settle into place, then get
    // pushed down again as later render batches mounted - reported as
    // "3 loading stages" with nothing indicating more was still coming.
    fetchGalleryAlbum.mockResolvedValue(ALBUM);
    const {getByText, UNSAFE_getByType} = renderScreen();
    await waitFor(() => expect(getByText('Donington Park')).toBeTruthy());
    const {FlatList} = require('react-native');
    const list = UNSAFE_getByType(FlatList);
    expect(list.props.getItemLayout).toBe(getItemLayout);
  });
});

describe('getItemLayout', () => {
  // `index` here is already a ROW index, not a flat photo index - confirmed
  // directly against the installed react-native source (FlatList.js's
  // _getItemCount returns ceil(data.length / numColumns) when numColumns >
  // 1, and getItemLayout is passed straight through to VirtualizedList
  // unmodified) - not an assumption. A previous version of these tests
  // (and the function itself) incorrectly treated the index as a flat
  // photo index and divided by NUM_COLUMNS again, which silently produced
  // offsets that shrank further from correct the further down the list you
  // went - root-caused live 2026-08-28 via a visible scroll-position jump
  // near the bottom of a 170-photo album.
  it('computes each row\'s offset directly from its row index', () => {
    const row0 = getItemLayout(null, 0);
    const row1 = getItemLayout(null, 1);
    const row2 = getItemLayout(null, 2);
    expect(row0.offset).toBe(0);
    expect(row1.offset).toBe(row0.length);
    expect(row2.offset).toBe(row0.length * 2);
  });

  it('returns a consistent row length regardless of row index', () => {
    const row0 = getItemLayout(null, 0);
    const row10 = getItemLayout(null, 10);
    expect(row10.length).toBe(row0.length);
  });

  it('returns the requested (row) index unchanged', () => {
    expect(getItemLayout(null, 42).index).toBe(42);
  });
});
