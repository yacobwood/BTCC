import React from 'react';
import {waitFor, fireEvent} from '@testing-library/react-native';
import TrackDetailScreen from '../../src/screens/TrackDetailScreen';
import {renderWithProviders, makeNav, makeRoute} from './testUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as featureFlags from '../../src/store/featureFlags';
import * as liveUrlsStore from '../../src/store/liveUrls';

jest.mock('../../src/utils/analytics', () => ({
  Analytics: {screen: jest.fn(), trackDetailViewed: jest.fn(), liveTimingOpened: jest.fn()},
}));

jest.mock('../../src/utils/weather', () => ({
  fetchWeather:       jest.fn().mockResolvedValue(null),
  weatherDescription: jest.fn(() => 'Partly cloudy'),
  weatherIcon:        jest.fn(() => 'wb-cloudy'),
  weatherIconColor:   jest.fn(() => '#fff'),
}));

jest.mock('../../src/api/client', () => ({
  fetchStandings: jest.fn().mockResolvedValue({standings: []}),
  fetchResults:   jest.fn().mockResolvedValue({rounds: []}),
  fetchCalendar:  jest.fn().mockResolvedValue({rounds: []}),
}));

jest.mock('../../src/api/parsers', () => ({
  parseResults: jest.fn().mockReturnValue([]),
}));

jest.mock('../../src/store/cache', () => ({
  cacheRead:  jest.fn().mockResolvedValue(null),
  cacheWrite: jest.fn().mockResolvedValue(undefined),
}));

// UKMapPin uses SVG which is problematic in tests — stub it
jest.mock('../../src/components/UKMapPin', () => ({__esModule: true, default: () => null}));

jest.mock('../../src/utils/broadcaster', () => ({
  BROADCASTERS: {
    uk:            {label: 'ITV4 / ITVX',   sub: 'Free · UK',        url: 'https://www.itv.com/hub/itv4'},
    international: {label: 'Official BTCC', sub: 'Free · Worldwide', url: 'https://www.youtube.com/@OfficialBTCC/streams'},
  },
  detectBroadcaster: jest.fn(() => 'uk'),
  useBroadcaster: jest.fn(() => 'uk'),
}));

const nav = makeNav();

// A complete track fixture matching the shape produced by parseCalendar after
// the tracks.json merge. lapPreviewUrl and youtubeUrls are explicit here
// because they are now separate concerns.
const TRACK = {
  round:            1,
  venue:            'Donington Park',
  date:             '19–20 Apr 2026',
  startDate:        '2026-04-19',
  endDate:          '2026-04-20',
  lat:              52.83,
  lng:              -1.37,
  about:            'One of the most iconic circuits in the UK.',
  btccFact:         'First BTCC race held here in 1977.',
  imageUrl:         null,
  cardBgUrl:        null,
  tslEventId:       null,   // null → not a live-timing round
  lapPreviewUrl:    null,   // explicitly null unless overridden in a test
  youtubeUrls:      [],     // race highlights only (indices 0,1,2 = Race 1,2,3)
  raceRecord:       {driver: 'Tom Ingram', time: '1:23.456', year: 2024},
  qualifyingRecord: {driver: 'Gordon Shedden', time: '1:22.000', year: 2023},
  sessions:         [{name: 'Free Practice', time: '09:00', day: 'SAT'}],
  photos:           [],
};

// Past race weekend — races fully finished
const PAST_TRACK = {
  ...TRACK,
  startDate:  '2024-04-20',
  endDate:    '2024-04-21',
  tslEventId: 42,
};

function render(track = TRACK) {
  AsyncStorage.getItem.mockResolvedValue(null);
  return renderWithProviders(
    <TrackDetailScreen route={makeRoute({track})} navigation={nav} />,
  );
}

describe('TrackDetailScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls Analytics.screen("track_detail") on mount', async () => {
    const {Analytics} = require('../../src/utils/analytics');
    render();
    await waitFor(() => expect(Analytics.screen).toHaveBeenCalledWith('track_detail'));
  });

  // ── Core rendering ────────────────────────────────────────────────────────────

  it('renders venue name', async () => {
    const {getAllByText} = render();
    await waitFor(() => expect(getAllByText('Donington Park').length).toBeGreaterThan(0));
  });

  it('renders the About section', async () => {
    const {getByText} = render();
    await waitFor(() => expect(getByText('One of the most iconic circuits in the UK.')).toBeTruthy());
  });

  it('renders the BTCC Fact section', async () => {
    const {getByText} = render();
    await waitFor(() => expect(getByText('First BTCC race held here in 1977.')).toBeTruthy());
  });

  it('renders the race record', async () => {
    const {getByText} = render();
    await waitFor(() => expect(getByText(/1:23.456/)).toBeTruthy());
  });

  it('renders the qualifying record', async () => {
    const {getByText} = render();
    await waitFor(() => expect(getByText(/1:22.000/)).toBeTruthy());
  });

  it('renders back button and navigates back when pressed', async () => {
    const {getByLabelText} = render();
    await waitFor(() => getByLabelText('Go back'));
    fireEvent.press(getByLabelText('Go back'));
    expect(nav.goBack).toHaveBeenCalled();
  });

  // ── Deep-link route: round number instead of full track object ────────────────

  it('renders without crashing when route provides round number instead of track', async () => {
    // calendar.json has round 1 = Donington Park
    const {toJSON} = renderWithProviders(
      <TrackDetailScreen route={makeRoute({round: '1'})} navigation={nav} />,
    );
    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it('returns null without crashing for unknown round number', () => {
    const {toJSON} = renderWithProviders(
      <TrackDetailScreen route={makeRoute({round: '999'})} navigation={nav} />,
    );
    expect(toJSON()).toBeNull();
  });

  // ── Live timing / results buttons ─────────────────────────────────────────────

  it('does not show live timing button when tslEventId is null', async () => {
    const {queryByLabelText} = render(TRACK); // TRACK has tslEventId: null
    await waitFor(() => expect(queryByLabelText('Open live timing')).toBeNull());
  });

  it('does not show live timing button for past race weekends (no live_updates needed)', async () => {
    const {queryByLabelText} = render(PAST_TRACK);
    // isPastRaceWeekend is true but live_updates flag is off by default
    await waitFor(() => expect(queryByLabelText('Open live timing')).toBeNull());
  });

  // ── Watch Live button ─────────────────────────────────────────────────────────
  // 2026-04-26 is a Sunday, 2026-04-25 is a Saturday.
  // LIVE_TRACK spans 2026-04-25 → 2026-04-26 and has a tslEventId so isRaceWeekend is true.

  describe('Watch Live button', () => {
    const {useBroadcaster} = require('../../src/utils/broadcaster');
    let flagsSpy;
    let liveUrlsSpy;

    const LIVE_TRACK = {
      ...TRACK,
      tslEventId: 99,
      startDate: '2026-04-25',
      endDate:   '2026-04-26',
    };

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-04-26T10:00:00Z')); // Sunday
      useBroadcaster.mockReturnValue('uk');
      flagsSpy = jest.spyOn(featureFlags, 'useFeatureFlags').mockReturnValue({
        track_weather: false, live_updates: false, live_chat: false,
      });
      liveUrlsSpy = jest.spyOn(liveUrlsStore, 'useLiveUrls').mockReturnValue({
        saturday: {uk: null, international: null, us: null},
        sunday: {uk: {url: 'https://www.itv.com/hub/itv4', label: 'ITV4 / ITVX'}, international: {url: 'https://www.youtube.com/@OfficialBTCC/streams', label: 'Official BTCC'}, us: null},
      });
    });

    afterEach(() => { jest.useRealTimers(); flagsSpy.mockRestore(); liveUrlsSpy.mockRestore(); });

    it('shows WATCH LIVE on a Sunday during a race weekend', async () => {
      const {findByText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track: LIVE_TRACK})} navigation={nav} />,
      );
      expect(await findByText('WATCH LIVE')).toBeTruthy();
    });

    it('shows broadcaster sub-label for UK users', async () => {
      useBroadcaster.mockReturnValue('uk');
      const {findByText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track: LIVE_TRACK})} navigation={nav} />,
      );
      expect(await findByText('ITV4 / ITVX')).toBeTruthy();
    });

    it('shows broadcaster sub-label for international users', async () => {
      useBroadcaster.mockReturnValue('international');
      const {findByText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track: LIVE_TRACK})} navigation={nav} />,
      );
      expect(await findByText('Official BTCC')).toBeTruthy();
    });

    it('does not show WATCH LIVE for US users (no broadcaster entry)', async () => {
      useBroadcaster.mockReturnValue('us');
      const {queryByText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track: LIVE_TRACK})} navigation={nav} />,
      );
      await waitFor(() => expect(queryByText('WATCH LIVE')).toBeNull());
    });

    it('does not show WATCH LIVE on a Saturday when saturday url is null', async () => {
      jest.setSystemTime(new Date('2026-04-25T10:00:00Z')); // Saturday
      const {queryByText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track: LIVE_TRACK})} navigation={nav} />,
      );
      await waitFor(() => expect(queryByText('WATCH LIVE')).toBeNull());
    });

    it('shows WATCH LIVE on a Saturday when saturday uk url is set (UK)', async () => {
      jest.setSystemTime(new Date('2026-04-25T10:00:00Z')); // Saturday
      liveUrlsSpy.mockReturnValue({
        saturday: {uk: {url: 'https://www.youtube.com/@ITVSport/streams', label: 'YouTube'}, international: null, us: null},
        sunday: {uk: null, international: null, us: null},
      });
      const {findByText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track: LIVE_TRACK})} navigation={nav} />,
      );
      expect(await findByText('WATCH LIVE')).toBeTruthy();
      expect(await findByText('YouTube')).toBeTruthy();
    });

    it('does not show WATCH LIVE on a Saturday for international users (UK-only stream)', async () => {
      jest.setSystemTime(new Date('2026-04-25T10:00:00Z')); // Saturday
      useBroadcaster.mockReturnValue('international');
      liveUrlsSpy.mockReturnValue({
        saturday: {uk: {url: 'https://www.youtube.com/@ITVSport/streams', label: 'YouTube'}, international: null, us: null},
        sunday: {uk: null, international: null, us: null},
      });
      const {queryByText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track: LIVE_TRACK})} navigation={nav} />,
      );
      await waitFor(() => expect(queryByText('WATCH LIVE')).toBeNull());
    });

    it('does not show WATCH LIVE on a Saturday for US when saturday us url is null', async () => {
      jest.setSystemTime(new Date('2026-04-25T10:00:00Z')); // Saturday
      useBroadcaster.mockReturnValue('us');
      liveUrlsSpy.mockReturnValue({
        saturday: {uk: {url: 'https://www.youtube.com/@ITVSport/streams', label: 'YouTube'}, international: null, us: null},
        sunday: {uk: null, international: null, us: null},
      });
      const {queryByText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track: LIVE_TRACK})} navigation={nav} />,
      );
      await waitFor(() => expect(queryByText('WATCH LIVE')).toBeNull());
    });

    it('does not show WATCH LIVE outside a race weekend', async () => {
      const {queryByText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track: TRACK})} navigation={nav} />, // TRACK has no tslEventId
      );
      await waitFor(() => expect(queryByText('WATCH LIVE')).toBeNull());
    });
  });

  // ── Year param ────────────────────────────────────────────────────────────────

  it('passes year=2027 to fetchCalendar when year param is 2027', async () => {
    const {fetchCalendar} = require('../../src/api/client');
    renderWithProviders(
      <TrackDetailScreen route={makeRoute({track: TRACK, year: 2027})} navigation={nav} />,
    );
    await waitFor(() => expect(fetchCalendar).toHaveBeenCalledWith(2027));
  });

  it('defaults to year=2026 when no year param is provided', async () => {
    const {fetchCalendar} = require('../../src/api/client');
    renderWithProviders(
      <TrackDetailScreen route={makeRoute({track: TRACK})} navigation={nav} />,
    );
    await waitFor(() => expect(fetchCalendar).toHaveBeenCalledWith(2026));
  });

  // ── Session times ─────────────────────────────────────────────────────────────

  it('renders session time from track data', async () => {
    const {getByText} = render();
    await waitFor(() => expect(getByText('Free Practice')).toBeTruthy());
  });

  // ── Lap Preview button ────────────────────────────────────────────────────────
  // lapPreviewUrl comes from tracks.json (year-agnostic); it is distinct from
  // youtubeUrls which holds race-highlight URLs for the specific season.

  describe('Lap Preview button', () => {
    const {useBroadcaster} = require('../../src/utils/broadcaster');

    const TRACK_WITH_PREVIEW = {
      ...TRACK,
      lapPreviewUrl: 'https://www.youtube.com/watch?v=hotlap123',
    };

    it('shows Lap Preview button for UK broadcaster when lapPreviewUrl is set', async () => {
      useBroadcaster.mockReturnValue('uk');
      const {findByLabelText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track: TRACK_WITH_PREVIEW})} navigation={nav} />,
      );
      expect(await findByLabelText('Watch Lap Preview on YouTube')).toBeTruthy();
    });

    it('does not show Lap Preview button when lapPreviewUrl is null', async () => {
      useBroadcaster.mockReturnValue('uk');
      // TRACK has lapPreviewUrl: null and youtubeUrls: [] so the youtube section should not render
      const {queryByLabelText} = render(TRACK);
      await waitFor(() => expect(queryByLabelText('Watch Lap Preview on YouTube')).toBeNull());
    });

    it('does not show Lap Preview button for international broadcaster even with a URL', async () => {
      useBroadcaster.mockReturnValue('international');
      const {queryByLabelText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track: TRACK_WITH_PREVIEW})} navigation={nav} />,
      );
      await waitFor(() => expect(queryByLabelText('Watch Lap Preview on YouTube')).toBeNull());
    });

    it('shows Lap Preview button on a 2027 track that has lapPreviewUrl set', async () => {
      useBroadcaster.mockReturnValue('uk');
      const track2027 = {
        ...TRACK,
        startDate:     '2027-04-10',
        endDate:       '2027-04-11',
        lapPreviewUrl: 'https://www.youtube.com/watch?v=hotlap123',
        youtubeUrls:   [], // no race highlights yet for 2027
      };
      const {findByLabelText, queryByLabelText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track: track2027, year: 2027})} navigation={nav} />,
      );
      expect(await findByLabelText('Watch Lap Preview on YouTube')).toBeTruthy();
      // Race highlight buttons should not appear when youtubeUrls is empty
      expect(queryByLabelText('Watch Race 1 on YouTube')).toBeNull();
    });
  });

  // ── Race highlight YouTube buttons ────────────────────────────────────────────
  // youtubeUrls[0,1,2] = Race 1, Race 2, Race 3 highlights (lap preview is separate)

  describe('Race YouTube buttons', () => {
    const {useBroadcaster} = require('../../src/utils/broadcaster');

    beforeEach(() => useBroadcaster.mockReturnValue('uk'));

    it('shows Race 1 and Race 2 buttons when youtubeUrls has two entries', async () => {
      const track = {
        ...TRACK,
        youtubeUrls: ['https://youtu.be/r1', 'https://youtu.be/r2'],
      };
      const {findByLabelText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track})} navigation={nav} />,
      );
      expect(await findByLabelText('Watch Race 1 on YouTube')).toBeTruthy();
      expect(await findByLabelText('Watch Race 2 on YouTube')).toBeTruthy();
    });

    it('shows all three race buttons when youtubeUrls has three entries', async () => {
      const track = {
        ...TRACK,
        youtubeUrls: ['https://youtu.be/r1', 'https://youtu.be/r2', 'https://youtu.be/r3'],
      };
      const {findByLabelText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track})} navigation={nav} />,
      );
      expect(await findByLabelText('Watch Race 1 on YouTube')).toBeTruthy();
      expect(await findByLabelText('Watch Race 2 on YouTube')).toBeTruthy();
      expect(await findByLabelText('Watch Race 3 on YouTube')).toBeTruthy();
    });

    it('does not show race buttons when youtubeUrls is empty', async () => {
      // TRACK has youtubeUrls: [] and lapPreviewUrl: null
      const {queryByLabelText} = render(TRACK);
      await waitFor(() => {
        expect(queryByLabelText('Watch Race 1 on YouTube')).toBeNull();
        expect(queryByLabelText('Watch Race 2 on YouTube')).toBeNull();
        expect(queryByLabelText('Watch Race 3 on YouTube')).toBeNull();
      });
    });

    it('lap preview and race buttons can coexist on the same track', async () => {
      const track = {
        ...TRACK,
        lapPreviewUrl: 'https://youtu.be/lap',
        youtubeUrls:   ['https://youtu.be/r1', 'https://youtu.be/r2', 'https://youtu.be/r3'],
      };
      const {findByLabelText} = renderWithProviders(
        <TrackDetailScreen route={makeRoute({track})} navigation={nav} />,
      );
      expect(await findByLabelText('Watch Lap Preview on YouTube')).toBeTruthy();
      expect(await findByLabelText('Watch Race 1 on YouTube')).toBeTruthy();
      expect(await findByLabelText('Watch Race 3 on YouTube')).toBeTruthy();
    });
  });

  // ── Weather ───────────────────────────────────────────────────────────────────

  it('does not crash when fetchWeather returns null', async () => {
    const {fetchWeather} = require('../../src/utils/weather');
    fetchWeather.mockResolvedValue(null);
    const {toJSON} = render();
    await waitFor(() => expect(toJSON()).toBeTruthy());
  });
});
