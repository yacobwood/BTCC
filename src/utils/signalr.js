// Lightweight SignalR client for TSL Live Timing
const RS = '\u001e';
const BASE_HTTP = 'https://livetiming.tsl-timing.com/results/live';
const BASE_WS = 'wss://livetiming.tsl-timing.com/results/live';
const REST_BASE = 'https://livetiming.tsl-timing.com/results/api/sessions';

export async function fetchSnapshot(eventId) {
  try {
    const res = await fetch(`${REST_BASE}/${eventId}/active`, {
      headers: {'X-TSL-Event': String(eventId)},
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

const HEARTBEAT_INTERVAL = 10000; // check every 10s
const HEARTBEAT_TIMEOUT = 20000;  // reconnect if silent for 20s

export function connectSignalR(eventId, onSession, onEntry) {
  let ws = null;
  let closed = false;
  let lastMessageAt = Date.now();
  let heartbeatTimer = null;

  const clearHeartbeat = () => { if (heartbeatTimer) clearInterval(heartbeatTimer); };

  const startHeartbeat = () => {
    clearHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (Date.now() - lastMessageAt > HEARTBEAT_TIMEOUT) {
        ws?.close(); // triggers onclose → reconnect
      }
    }, HEARTBEAT_INTERVAL);
  };

  (async () => {
    try {
      const negRes = await fetch(`${BASE_HTTP}/negotiate?negotiateVersion=1`, {
        method: 'POST',
        headers: {'X-TSL-Event': String(eventId)},
      });
      const neg = await negRes.json();
      const token = neg.connectionToken;
      if (!token) return;

      ws = new WebSocket(`${BASE_WS}?id=${token}`);

      ws.onopen = () => {
        lastMessageAt = Date.now();
        startHeartbeat();
        ws.send(JSON.stringify({protocol: 'json', version: 1}) + RS);
      };

      let handshakeDone = false;
      ws.onmessage = (event) => {
        lastMessageAt = Date.now();
        const messages = event.data.split(RS).filter(m => m.trim());
        for (const raw of messages) {
          try {
            const json = JSON.parse(raw);
            if (!handshakeDone) {
              handshakeDone = true;
              ws.send(JSON.stringify({type: 1, target: 'registerForEvent', arguments: [eventId]}) + RS);
              continue;
            }
            if (json.type === 1) {
              const target = json.target;
              const args = json.arguments;
              if (target === 'sessionUpdated' && args?.[0]) onSession(args[0]);
              if (target === 'resultUpdated' && args?.[0]) onEntry(args[0]);
            }
            if (json.type === 6) ws.send(JSON.stringify({type: 6}) + RS); // pong
          } catch {}
        }
      };

      ws.onerror = () => {};
      ws.onclose = () => {
        clearHeartbeat();
        if (!closed) setTimeout(() => connectSignalR(eventId, onSession, onEntry), 3000);
      };
    } catch {}
  })();

  return () => { closed = true; clearHeartbeat(); ws?.close(); };
}

export function parseSession(raw) {
  const clock = raw.sessionClock || {};
  const track = raw.track || {};
  const fl = raw.fastestLap || {};
  const classArr = raw.classification || [];
  return {
    name: raw.name || '',
    series: raw.series || '',
    sessionFlag: raw.sessionFlag || 'Green',
    timeToGo: clock.timeToGo || '',
    clockRunning: clock.running || false,
    trackName: track.displayName || track.name || '',
    fastestLapId: fl.id || '',
    classification: classArr.map(e => parseEntry(e)),
  };
}

export function parseEntry(e) {
  const result = e.result || {};
  const cd = e.currentDriver || {};
  const fullName = cd.firstName && cd.lastName
    ? `${cd.firstName} ${cd.lastName}`
    : e.name || '';
  return {
    id: e.id || '',
    no: e.no || '',
    name: fullName,
    team: e.team || '',
    position: result.position || 0,
    laps: result.laps || 0,
    raceTime: result.raceTime || '',
    fastLapTime: result.fastLapTime || '',
    gap: result.gap || '',
    lastLapTime: e.lastLapTime || '',
    pitStops: result.pitStops || 0,
    posChange: result.posChange || 0,
    state: e.state || 0,
  };
}
