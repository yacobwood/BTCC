import {fetchSnapshot, connectSignalR, parseSession, parseEntry} from '../../src/utils/signalr';

// ─── parseEntry ───────────────────────────────────────────────────────────────

describe('parseEntry', () => {
  const BASE = {
    id: 'car1',
    no: '80',
    name: 'T Ingram',
    team: 'Ingram Racing',
    lastLapTime: '1:23.456',
    state: 1,
    result: {
      position: 1,
      laps: 20,
      raceTime: '30:01.234',
      fastLapTime: '1:23.456',
      gap: '',
      pitStops: 1,
      posChange: 2,
    },
    currentDriver: {firstName: 'Tom', lastName: 'Ingram'},
  };

  it('combines firstName + lastName from currentDriver', () => {
    expect(parseEntry(BASE).name).toBe('Tom Ingram');
  });

  it('falls back to entry.name when currentDriver is absent', () => {
    const raw = {...BASE, currentDriver: {}};
    expect(parseEntry(raw).name).toBe('T Ingram');
  });

  it('maps all result fields correctly', () => {
    const e = parseEntry(BASE);
    expect(e.id).toBe('car1');
    expect(e.no).toBe('80');
    expect(e.team).toBe('Ingram Racing');
    expect(e.position).toBe(1);
    expect(e.laps).toBe(20);
    expect(e.raceTime).toBe('30:01.234');
    expect(e.fastLapTime).toBe('1:23.456');
    expect(e.pitStops).toBe(1);
    expect(e.posChange).toBe(2);
    expect(e.state).toBe(1);
    expect(e.lastLapTime).toBe('1:23.456');
  });

  it('returns safe defaults when result is missing', () => {
    const raw = {id: 'x', currentDriver: {}};
    const e = parseEntry(raw);
    expect(e.position).toBe(0);
    expect(e.laps).toBe(0);
    expect(e.pitStops).toBe(0);
    expect(e.posChange).toBe(0);
  });
});

// ─── parseSession ─────────────────────────────────────────────────────────────

describe('parseSession', () => {
  const RAW = {
    name: 'Race 1',
    series: 'BTCC',
    sessionFlag: 'Green',
    sessionClock: {timeToGo: '29:59', running: true},
    track: {displayName: 'Donington Park', name: 'Donington'},
    fastestLap: {id: 'car1'},
    classification: [
      {
        id: 'car1',
        no: '80',
        name: 'T Ingram',
        team: 'Ingram Racing',
        lastLapTime: '1:23.0',
        state: 1,
        result: {position: 1, laps: 5, raceTime: '5:00', fastLapTime: '1:23.0', gap: '', pitStops: 0, posChange: 0},
        currentDriver: {firstName: 'Tom', lastName: 'Ingram'},
      },
    ],
  };

  it('maps session metadata', () => {
    const s = parseSession(RAW);
    expect(s.name).toBe('Race 1');
    expect(s.series).toBe('BTCC');
    expect(s.sessionFlag).toBe('Green');
    expect(s.timeToGo).toBe('29:59');
    expect(s.clockRunning).toBe(true);
    expect(s.trackName).toBe('Donington Park');
    expect(s.fastestLapId).toBe('car1');
  });

  it('maps classification array through parseEntry', () => {
    const s = parseSession(RAW);
    expect(s.classification).toHaveLength(1);
    expect(s.classification[0].name).toBe('Tom Ingram');
  });

  it('handles empty/missing fields gracefully', () => {
    const s = parseSession({});
    expect(s.name).toBe('');
    expect(s.sessionFlag).toBe('Green'); // default
    expect(s.clockRunning).toBe(false);
    expect(s.classification).toEqual([]);
  });

  it('prefers track.displayName over track.name', () => {
    const s = parseSession({track: {displayName: 'Display', name: 'Fallback'}});
    expect(s.trackName).toBe('Display');
  });

  it('falls back to track.name when displayName is absent', () => {
    const s = parseSession({track: {name: 'Fallback'}});
    expect(s.trackName).toBe('Fallback');
  });
});

// ─── fetchSnapshot ────────────────────────────────────────────────────────────

describe('fetchSnapshot', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns parsed JSON on a successful response', async () => {
    const payload = {id: 'session1', name: 'Race 1'};
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });
    const result = await fetchSnapshot(42);
    expect(result).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('42'),
      expect.objectContaining({headers: {'X-TSL-Event': '42'}}),
    );
  });

  it('returns null when response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ok: false});
    expect(await fetchSnapshot(42)).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    expect(await fetchSnapshot(42)).toBeNull();
  });
});

// ─── connectSignalR ───────────────────────────────────────────────────────────

describe('connectSignalR', () => {
  const RS = '\u001e';
  let ws;

  // Minimal WebSocket mock that captures callbacks
  class MockWebSocket {
    constructor(url) { this.url = url; ws = this; }
    send = jest.fn();
    close = jest.fn();
    // helpers to fire events from test
    triggerOpen()         { this.onopen?.(); }
    triggerMessage(data)  { this.onmessage?.({data}); }
    triggerClose()        { this.onclose?.(); }
  }

  beforeEach(() => {
    jest.useFakeTimers();
    global.WebSocket = MockWebSocket;
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function setupNegotiation() {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({connectionToken: 'tok123'}),
    });
  }

  async function connect(eventId = 99, onSession = jest.fn(), onEntry = jest.fn()) {
    setupNegotiation();
    const teardown = connectSignalR(eventId, onSession, onEntry);
    // Let the async negotiation + WebSocket construction run
    await Promise.resolve();
    await Promise.resolve();
    return {teardown, onSession, onEntry};
  }

  it('negotiates before opening the WebSocket', async () => {
    await connect();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('negotiate'),
      expect.objectContaining({method: 'POST'}),
    );
    expect(ws).toBeDefined();
    expect(ws.url).toContain('tok123');
  });

  it('sends handshake on WebSocket open', async () => {
    await connect();
    ws.triggerOpen();
    const handshake = ws.send.mock.calls[0][0];
    expect(JSON.parse(handshake.replace(RS, ''))).toMatchObject({protocol: 'json', version: 1});
  });

  it('registers for event after handshake acknowledgement', async () => {
    await connect(99);
    ws.triggerOpen();
    // First message = handshake ack (empty object)
    ws.triggerMessage(JSON.stringify({}) + RS);
    const registerMsg = ws.send.mock.calls[1][0];
    expect(JSON.parse(registerMsg.replace(RS, ''))).toMatchObject({
      type: 1,
      target: 'registerForEvent',
      arguments: [99],
    });
  });

  it('calls onSession when sessionUpdated message arrives', async () => {
    const {onSession} = await connect();
    ws.triggerOpen();
    ws.triggerMessage(JSON.stringify({}) + RS); // handshake ack
    const sessionData = {name: 'Race 1'};
    ws.triggerMessage(JSON.stringify({type: 1, target: 'sessionUpdated', arguments: [sessionData]}) + RS);
    expect(onSession).toHaveBeenCalledWith(sessionData);
  });

  it('calls onEntry when resultUpdated message arrives', async () => {
    const {onEntry} = await connect();
    ws.triggerOpen();
    ws.triggerMessage(JSON.stringify({}) + RS); // handshake ack
    const entryData = {id: 'car1', position: 1};
    ws.triggerMessage(JSON.stringify({type: 1, target: 'resultUpdated', arguments: [entryData]}) + RS);
    expect(onEntry).toHaveBeenCalledWith(entryData);
  });

  it('sends pong when a ping (type 6) is received', async () => {
    await connect();
    ws.triggerOpen();
    ws.triggerMessage(JSON.stringify({}) + RS); // handshake ack
    ws.send.mockClear();
    ws.triggerMessage(JSON.stringify({type: 6}) + RS);
    const pongMsg = ws.send.mock.calls[0]?.[0];
    expect(JSON.parse(pongMsg?.replace(RS, ''))).toMatchObject({type: 6});
  });

  it('schedules reconnect when WebSocket closes unexpectedly', async () => {
    const reconnectSpy = jest.spyOn(global, 'setTimeout');
    await connect();
    ws.triggerOpen();
    ws.triggerClose();
    expect(reconnectSpy).toHaveBeenCalledWith(expect.any(Function), 3000);
  });

  it('teardown prevents reconnect and closes the socket', async () => {
    const {teardown} = await connect();
    ws.triggerOpen();
    teardown();
    expect(ws.close).toHaveBeenCalled();
    // After teardown, closing the WS must NOT schedule a reconnect
    const reconnectsBefore = setTimeout.mock?.calls?.length ?? 0;
    ws.triggerClose();
    expect(setTimeout.mock?.calls?.length ?? 0).toBe(reconnectsBefore);
  });
});
