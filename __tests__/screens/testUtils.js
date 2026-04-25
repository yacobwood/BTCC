/**
 * Shared render helpers for screen-level RNTL tests.
 *
 * Wraps components in all the providers the app uses so each test
 * only needs to supply the props unique to the screen under test.
 */
import React from 'react';
import {render} from '@testing-library/react-native';
import {FavouriteDriverProvider} from '../../src/store/favouriteDriver';
import {SettingsProvider} from '../../src/store/settings';
import {UnitsProvider} from '../../src/store/units';
import {FeatureFlagsProvider} from '../../src/store/featureFlags';

export function AllProviders({children}) {
  return (
    <FeatureFlagsProvider>
      <SettingsProvider>
        <UnitsProvider>
          <FavouriteDriverProvider>
            {children}
          </FavouriteDriverProvider>
        </UnitsProvider>
      </SettingsProvider>
    </FeatureFlagsProvider>
  );
}

export function renderWithProviders(ui, options = {}) {
  return render(ui, {wrapper: AllProviders, ...options});
}

// A minimal navigation prop accepted by most screens
export function makeNav(overrides = {}) {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
    getParent: jest.fn(() => ({addListener: jest.fn(() => jest.fn())})),
    ...overrides,
  };
}

// Minimal route prop
export function makeRoute(params = {}) {
  return {params};
}

// ── Shared mock data ──────────────────────────────────────────────────────────

export const MOCK_DRIVERS_RAW = [
  {name: 'Tom Ingram',      number: 80, team: 'Team Ingram',   imageUrl: null, cardBgUrl: null},
  {name: 'Gordon Shedden',  number: 52, team: 'Laser Tools',   imageUrl: null, cardBgUrl: null},
  {name: 'Colin Turkington',number: 4,  team: 'West Surrey',   imageUrl: null, cardBgUrl: null},
];

export const MOCK_GRID = {
  drivers: MOCK_DRIVERS_RAW,
  teams: [
    {name: 'Team Ingram',  cardBgUrl: null, cardBgThumbUrl: null, carImageUrl: null, carThumbUrl: null},
    {name: 'Laser Tools',  cardBgUrl: null, cardBgThumbUrl: null, carImageUrl: null, carThumbUrl: null},
  ],
};

export const MOCK_ROUND = {
  round: 1,
  venue: 'Donington Park',
  races: [
    {
      label: 'Free Practice',
      results: [
        {driver: 'Tom Ingram',       position: 1, time: '1:23.456', team: 'Team Ingram',  points: 0, bestLap: '1:23.456', gap: null, laps: 10, fastestLap: false, leadLap: false, pole: false},
        {driver: 'Gordon Shedden',   position: 2, time: '1:23.789', team: 'Laser Tools',  points: 0, bestLap: '1:23.789', gap: '0.333', laps: 10, fastestLap: false, leadLap: false, pole: false},
      ],
    },
    {
      label: 'Qualifying',
      results: [
        {driver: 'Tom Ingram',       position: 1, time: '1:22.111', team: 'Team Ingram',  points: 0, bestLap: '1:22.111', gap: null, laps: 5, fastestLap: false, leadLap: false, pole: true},
        {driver: 'Gordon Shedden',   position: 2, time: '1:22.345', team: 'Laser Tools',  points: 0, bestLap: '1:22.345', gap: '0.234', laps: 5, fastestLap: false, leadLap: false, pole: false},
      ],
    },
    {
      label: 'Qualifying Race',
      results: [
        {driver: 'Tom Ingram',       position: 1, time: '23:01.234', team: 'Team Ingram',  points: 4, bestLap: '1:24.0', gap: null, laps: 15, fastestLap: false, leadLap: false, pole: false},
        {driver: 'Gordon Shedden',   position: 2, time: '23:02.000', team: 'Laser Tools',  points: 3, bestLap: '1:24.5', gap: '0.766', laps: 15, fastestLap: false, leadLap: false, pole: false},
        {driver: 'Colin Turkington', position: 0, time: 'DNF',       team: 'West Surrey',  points: 0, bestLap: null, gap: null, laps: 5, fastestLap: false, leadLap: false, pole: false},
      ],
    },
    {
      label: 'Race 1',
      results: [
        {driver: 'Gordon Shedden',   position: 1, time: '30:01.0', team: 'Laser Tools',  points: 25, bestLap: '1:24.1', gap: null, laps: 20, fastestLap: true, leadLap: false, pole: false},
        {driver: 'Tom Ingram',       position: 2, time: '30:02.0', team: 'Team Ingram',  points: 18, bestLap: '1:24.2', gap: '1.0', laps: 20, fastestLap: false, leadLap: false, pole: false},
      ],
    },
    {
      label: 'Race 2',
      results: [
        {driver: 'Tom Ingram',       position: 1, time: '30:00.0', team: 'Team Ingram',  points: 25, bestLap: '1:23.9', gap: null, laps: 20, fastestLap: false, leadLap: false, pole: false},
        {driver: 'Gordon Shedden',   position: 2, time: '30:01.5', team: 'Laser Tools',  points: 18, bestLap: '1:24.0', gap: '1.5', laps: 20, fastestLap: false, leadLap: false, pole: false},
      ],
    },
    {
      label: 'Race 3',
      results: [
        {driver: 'Colin Turkington', position: 1, time: '30:05.0', team: 'West Surrey',  points: 25, bestLap: '1:24.5', gap: null, laps: 20, fastestLap: false, leadLap: false, pole: false},
        {driver: 'Tom Ingram',       position: 2, time: '30:06.0', team: 'Team Ingram',  points: 18, bestLap: '1:24.6', gap: '1.0', laps: 20, fastestLap: false, leadLap: false, pole: false},
      ],
    },
  ],
};

export const MOCK_ARTICLES = [
  {id: 1, title: 'Ingram wins Race 1 at Donington',      pubDate: '19 Apr 2026', imageUrl: null, source: 'btcc.net', category: 'LATEST NEWS', sortDate: '2026-04-19'},
  {id: 2, title: 'Shedden claims pole position',          pubDate: '18 Apr 2026', imageUrl: null, source: 'btcc.net', category: 'LATEST NEWS', sortDate: '2026-04-18'},
  {id: 3, title: 'Turkington battles through the field',  pubDate: '18 Apr 2026', imageUrl: null, source: 'btcc.net', category: 'LATEST NEWS', sortDate: '2026-04-18'},
  {id: 4, title: 'Round 1 preview',                       pubDate: '17 Apr 2026', imageUrl: null, source: 'btcc.net', category: 'LATEST NEWS', sortDate: '2026-04-17'},
];
