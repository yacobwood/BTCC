import React from 'react';
import {waitFor, fireEvent} from '@testing-library/react-native';
import GalleryTab from '../../src/components/GalleryTab';
import {renderWithProviders, makeNav} from '../screens/testUtils';
import {Colors} from '../../src/theme/colors';

jest.mock('../../src/api/client', () => ({
  fetchGallery: jest.fn(),
}));
jest.mock('../../src/api/parsers', () => ({
  parseGalleryIndex: jest.fn(json => json),
}));
jest.mock('../../src/utils/analytics', () => ({
  Analytics: {
    galleryAlbumOpen: jest.fn(),
    galleryIndexLoadFailed: jest.fn(),
    pullToRefresh: jest.fn(),
    retryClicked: jest.fn(),
  },
}));

const {fetchGallery} = require('../../src/api/client');
const {Analytics} = require('../../src/utils/analytics');

const ALBUMS = [
  {slug: 'donington-park-gallery', title: 'Donington Park', cover: 'https://example.com/cover1.jpg', round: 1, venue: 'Donington Park', isCanonical: true, capturedCount: 3, totalCount: 3, complete: true},
  {slug: '2026-season-launch', title: '2026 Season Launch', cover: 'https://example.com/cover2.jpg', round: null, venue: null, isCanonical: false, capturedCount: 5, totalCount: 5, complete: true},
];

function renderTab(nav = makeNav()) {
  return renderWithProviders(<GalleryTab year={2026} navigation={nav} />);
}

describe('GalleryTab', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a loading spinner before the fetch resolves', () => {
    fetchGallery.mockReturnValue(new Promise(() => {})); // never resolves
    const {UNSAFE_getByType} = renderTab();
    const {ActivityIndicator} = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders an album tile with title and photo count once loaded', async () => {
    fetchGallery.mockResolvedValue({season: 2026, albums: ALBUMS});
    const {getByText} = renderTab();
    await waitFor(() => expect(getByText('Donington Park')).toBeTruthy());
    expect(getByText('3 photos')).toBeTruthy();
  });

  it('groups albums into RACE WEEKENDS and OTHER sections', async () => {
    fetchGallery.mockResolvedValue({season: 2026, albums: ALBUMS});
    const {getByText} = renderTab();
    await waitFor(() => expect(getByText('RACE WEEKENDS')).toBeTruthy());
    expect(getByText('OTHER')).toBeTruthy();
  });

  it('shows a non-canonical album (e.g. a "Captured Moments" set) in OTHER even though it has a real round, with no round chip', async () => {
    // Root-caused live 2026-08-28: round 2 has both a main album and a
    // separately-published "The Captured Moments: Brands Hatch Indy" one -
    // both correctly resolve to round 2 in their own data (isCanonical
    // distinguishes which one gets to be the Race Weekends tile), but
    // showing both as their own R2-chip tile read as a duplicate/bug.
    const variant = {
      slug: 'the-captured-moments-brands-hatch-indy', title: 'The Captured Moments: Brands Hatch Indy',
      cover: 'https://example.com/cover3.jpg', round: 2, venue: 'Brands Hatch Indy', isCanonical: false,
      capturedCount: 21, totalCount: 21, complete: true,
    };
    fetchGallery.mockResolvedValue({season: 2026, albums: [...ALBUMS, variant]});
    const {getByText, queryByText} = renderTab();
    await waitFor(() => expect(getByText('The Captured Moments: Brands Hatch Indy')).toBeTruthy());
    expect(queryByText('R2')).toBeNull();
  });

  it('renders the odd-row layout spacer as an invisible box, not a visible dark tile', async () => {
    // Root-caused live 2026-08-28: ALBUMS has exactly 1 Race Weekends album
    // and 1 Other album, so both sections' single-item rows need a spacer
    // to keep the 2-column grid aligned - the spacer used to reuse the same
    // styles.tile as a real tile (including its Colors.card background),
    // which rendered as a visible dark box that looked like a real, blank
    // album. Only the 2 real album tiles should carry that background.
    fetchGallery.mockResolvedValue({season: 2026, albums: ALBUMS});
    const {getByText, UNSAFE_getAllByType} = renderTab();
    await waitFor(() => expect(getByText('Donington Park')).toBeTruthy());
    const {View} = require('react-native');
    const cardBackgrounds = UNSAFE_getAllByType(View).filter(el => {
      const style = [].concat(el.props.style || []);
      return style.some(s => s && s.backgroundColor === Colors.card);
    });
    expect(cardBackgrounds.length).toBe(ALBUMS.length);
  });

  it('navigates to GalleryAlbum and fires galleryAlbumOpen when a tile is pressed', async () => {
    fetchGallery.mockResolvedValue({season: 2026, albums: ALBUMS});
    const nav = makeNav();
    const {getByText} = renderTab(nav);
    await waitFor(() => expect(getByText('Donington Park')).toBeTruthy());
    fireEvent.press(getByText('Donington Park'));
    expect(nav.navigate).toHaveBeenCalledWith('GalleryAlbum', {season: 2026, albumSlug: 'donington-park-gallery'});
    expect(Analytics.galleryAlbumOpen).toHaveBeenCalledWith(2026, 'donington-park-gallery');
  });

  it('shows an empty state when there are no albums yet', async () => {
    fetchGallery.mockResolvedValue({season: 2026, albums: []});
    const {getByText} = renderTab();
    await waitFor(() => expect(getByText('No gallery albums for 2026 yet')).toBeTruthy());
  });

  it('shows a retry button and fires galleryIndexLoadFailed on fetch failure', async () => {
    fetchGallery.mockRejectedValue(new Error('network down'));
    const {getByText, getByLabelText} = renderTab();
    await waitFor(() => expect(getByText("Couldn't load the gallery")).toBeTruthy());
    expect(Analytics.galleryIndexLoadFailed).toHaveBeenCalledWith(2026, 'network down');
    fetchGallery.mockResolvedValue({season: 2026, albums: ALBUMS});
    fireEvent.press(getByLabelText('Retry'));
    expect(Analytics.retryClicked).toHaveBeenCalledWith('gallery');
    await waitFor(() => expect(getByText('Donington Park')).toBeTruthy());
  });

  it('calls fetchGallery with forceRefresh on pull-to-refresh', async () => {
    fetchGallery.mockResolvedValue({season: 2026, albums: ALBUMS});
    const {getByText, UNSAFE_getByType} = renderTab();
    await waitFor(() => expect(getByText('Donington Park')).toBeTruthy());
    const {FlatList} = require('react-native');
    const list = UNSAFE_getByType(FlatList);
    list.props.refreshControl.props.onRefresh();
    expect(Analytics.pullToRefresh).toHaveBeenCalledWith('gallery');
    await waitFor(() => expect(fetchGallery).toHaveBeenLastCalledWith(2026, true));
  });
});
