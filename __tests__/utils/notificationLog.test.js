import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  logNotificationEvent,
  getNotificationLog,
  formatNotificationLog,
  buildDiagnosticsText,
  MAX_ENTRIES,
} from '../../src/utils/notificationLog';

// In-memory AsyncStorage so read-modify-write behaves like the real thing.
let store;
beforeEach(() => {
  store = {};
  AsyncStorage.getItem.mockImplementation(k => Promise.resolve(k in store ? store[k] : null));
  AsyncStorage.setItem.mockImplementation((k, v) => { store[k] = v; return Promise.resolve(); });
});
afterEach(() => {
  AsyncStorage.getItem.mockReset();
  AsyncStorage.setItem.mockReset();
});

describe('notificationLog', () => {
  it('appends timestamped events', async () => {
    await logNotificationEvent({kind: 'push', outcome: 'shown', title: 'A'});
    await logNotificationEvent({kind: 'spoiler', action: 'on'});
    const list = await getNotificationLog();
    expect(list.map(e => e.kind)).toEqual(['push', 'spoiler']);
    expect(list[0].t).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it(`keeps only the newest ${MAX_ENTRIES} events`, async () => {
    for (let i = 0; i < MAX_ENTRIES + 5; i++) await logNotificationEvent({kind: 'push', outcome: 'shown', title: `n${i}`});
    const list = await getNotificationLog();
    expect(list).toHaveLength(MAX_ENTRIES);
    expect(list[0].title).toBe('n5');
    expect(list[list.length - 1].title).toBe(`n${MAX_ENTRIES + 4}`);
  });

  it('never throws when storage fails (must not break notification display)', async () => {
    AsyncStorage.getItem.mockImplementation(() => Promise.reject(new Error('broken')));
    await expect(logNotificationEvent({kind: 'push'})).resolves.toBeUndefined();
    await expect(getNotificationLog()).resolves.toEqual([]);
  });

  it('formats newest first, one readable line per event', () => {
    const text = formatNotificationLog([
      {t: '2026-10-10T14:36:00.000Z', kind: 'spoiler', action: 'on'},
      {t: '2026-10-10T15:19:05.000Z', kind: 'push', outcome: 'suppressed_spoiler', channel: 'news', type: 'news', title: 'Flying Scotsman Moffat tames Brands Hatch'},
      {t: '2026-10-10T15:20:00.000Z', kind: 'topics', failed: ['-news_alerts']},
    ], 'HEADER');
    expect(text.split('\n')).toEqual([
      'HEADER',
      '2026-10-10 15:20:00Z topic changes failed: -news_alerts',
      '2026-10-10 15:19:05Z push suppressed_spoiler [news/news] Flying Scotsman Moffat tames Brands Hatch',
      '2026-10-10 14:36:00Z spoiler mode on',
    ]);
  });

  it('diagnostics text includes app version, platform and current spoiler state', async () => {
    store.setting_spoiler_free = 'true';
    await logNotificationEvent({kind: 'spoiler', action: 'on'});
    const {text, entries} = await buildDiagnosticsText();
    expect(entries).toBe(1);
    expect(text.split('\n')[0]).toMatch(/^BTCC Hub \d+\.\d+\.\d+ \(\w+ .*\) - spoiler mode on - 1 log entries$/);
    expect(text).toContain('spoiler mode on');
  });
});
