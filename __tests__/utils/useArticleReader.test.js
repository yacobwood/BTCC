import {renderHook, act, cleanup} from '@testing-library/react-native';
import {useArticleReader, __resetVoiceStateForTests} from '../../src/utils/useArticleReader';

// Overrides the package's own bundled jest mock (already applied globally
// via __mocks__/@mhpdev/react-native-speech.js) with one that actually
// captures the onStart/onFinish/onError handlers and hands back real,
// incrementing utterance ids from speak() - the bundled default mock's
// event methods just return a static {remove} stub and never store the
// handler or a meaningful id at all and this hook now matches events to
// utterance ids to tell a stale/superseded event apart from a current one.
let nextUtteranceId;
let handlers;

// jest.fn() here specifically - NOT a separately require('jest-mock').fn()
// copy. That alternative looks equivalent (same mock-function behaviour)
// but isn't registered with this test file's own jest instance, so
// jest.clearAllMocks() in beforeEach silently can't find or clear it,
// leaking every call (and its exact arguments) into every later test.
jest.mock('@mhpdev/react-native-speech', () => ({
  __esModule: true,
  default: {
    maxInputLength: 4000,
    speak: jest.fn(),
    pause: jest.fn(() => Promise.resolve(true)),
    resume: jest.fn(() => Promise.resolve(true)),
    stop: jest.fn(() => Promise.resolve()),
    configure: jest.fn(),
    // A network voice is deliberately included alongside the local one in
    // the default list - resolveVoice() is local-only by design now, so
    // these tests also double as proof a network voice being present and
    // even listed first doesn't change what gets picked.
    getAvailableVoices: jest.fn(() => Promise.resolve([
      {identifier: 'en-gb-x-network', language: 'en-GB', quality: 'Enhanced'},
      {identifier: 'en-gb-x-local', language: 'en-GB', quality: 'Enhanced'},
    ])),
    onStart: jest.fn((h) => { global.__ttsHandlers.onStart = h; return {remove: jest.fn()}; }),
    onFinish: jest.fn((h) => { global.__ttsHandlers.onFinish = h; return {remove: jest.fn()}; }),
    onError: jest.fn((h) => { global.__ttsHandlers.onError = h; return {remove: jest.fn()}; }),
  },
}));

const Speech = require('@mhpdev/react-native-speech').default;

beforeEach(() => {
  jest.clearAllMocks();
  __resetVoiceStateForTests();
  nextUtteranceId = 0;
  handlers = {onStart: null, onFinish: null, onError: null};
  global.__ttsHandlers = handlers;
  Speech.speak.mockImplementation(() => Promise.resolve(`id-${++nextUtteranceId}`));
});

afterEach(() => {
  // Unmount every hook rendered by the test that just ran - without this,
  // a hook whose start-timeout or fire-and-forget speakChunk() chain never
  // resolved (e.g. an assertion threw before the test reached its own
  // stop()/status check) stays mounted and can still fire real calls into
  // whichever test runs next. cleanup() runs the hook's own effect cleanup,
  // which sets its activeRef false and calls Speech.stop(), so any stray
  // continuation still in flight hits an early-return guard instead of
  // acting. jest.useRealTimers() likewise guards against a test that uses
  // fake timers throwing before it reaches its own cleanup call - fake
  // timers are global state, not reset automatically between tests.
  cleanup();
  jest.useRealTimers();
});

describe('useArticleReader', () => {
  it('starts idle', () => {
    const {result} = renderHook(() => useArticleReader());
    expect(result.current.status).toBe('idle');
    expect(result.current.isBuffering).toBe(false);
  });

  it('start() configures the local voice, speaks the text and moves to playing', async () => {
    const {result} = renderHook(() => useArticleReader());
    await act(async () => { await result.current.start('Hello world.'); });
    expect(Speech.configure).toHaveBeenCalledWith({voice: 'en-gb-x-local', pitch: 1.0, rate: 1.0});
    expect(Speech.speak).toHaveBeenCalledWith('Hello world.');
    expect(result.current.status).toBe('playing');
  });

  it('prefers the specific voice Voice Lab settled on over the generic first-en-GB-local pick', async () => {
    Speech.getAvailableVoices.mockResolvedValueOnce([
      {identifier: 'en-gb-x-gba-local', language: 'en-GB', quality: 'Enhanced'}, // listed first by the OS
      {identifier: 'en-gb-x-gbb-local', language: 'en-GB', quality: 'Enhanced'}, // the one actually chosen
    ]);
    const {result} = renderHook(() => useArticleReader());
    await act(async () => { await result.current.start('Hello world.'); });
    expect(Speech.configure).toHaveBeenCalledWith({voice: 'en-gb-x-gbb-local', pitch: 1.0, rate: 1.0});
  });

  it('falls back to the first en-GB local voice when the preferred identifier is not on the device', async () => {
    Speech.getAvailableVoices.mockResolvedValueOnce([
      {identifier: 'en-gb-x-network', language: 'en-GB', quality: 'Enhanced'},
      {identifier: 'en-gb-x-some-other-local', language: 'en-GB', quality: 'Enhanced'},
    ]);
    const {result} = renderHook(() => useArticleReader());
    await act(async () => { await result.current.start('Hello world.'); });
    expect(Speech.configure).toHaveBeenCalledWith({voice: 'en-gb-x-some-other-local', pitch: 1.0, rate: 1.0});
  });

  it('is buffering from start() until onStart fires for that utterance, then stops', async () => {
    const {result} = renderHook(() => useArticleReader());
    await act(async () => { await result.current.start('Hello world.'); });
    expect(result.current.isBuffering).toBe(true);
    act(() => { handlers.onStart({id: 'id-1'}); });
    expect(result.current.isBuffering).toBe(false);
  });

  it('does nothing for empty/whitespace-only text', async () => {
    const {result} = renderHook(() => useArticleReader());
    await act(async () => { await result.current.start('   '); });
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('onStart clears the pending start timeout, so normal playback is never treated as a failure', async () => {
    jest.useFakeTimers();
    const {result} = renderHook(() => useArticleReader());
    await act(async () => { await result.current.start('Hello world.'); });
    act(() => { handlers.onStart({id: 'id-1'}); });
    await act(async () => { await jest.advanceTimersByTimeAsync(10000); }); // well past the start timeout
    expect(result.current.status).toBe('playing');
    jest.useRealTimers();
  });

  it('calls onFinish once every chunk has completed and returns to idle', async () => {
    const onFinish = jest.fn();
    const {result} = renderHook(() => useArticleReader({onFinish}));
    await act(async () => { await result.current.start('Short article.'); });
    act(() => { handlers.onStart({id: 'id-1'}); });
    await act(async () => { await handlers.onFinish({id: 'id-1'}); });
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
  });

  it('splits long text into multiple chunks and speaks the next one once the current one finishes', async () => {
    const longText = 'A sentence. '.repeat(400); // well over the 3500-char chunk size
    const {result} = renderHook(() => useArticleReader());
    await act(async () => { await result.current.start(longText); });
    expect(Speech.speak).toHaveBeenCalledTimes(1);
    act(() => { handlers.onStart({id: 'id-1'}); });

    await act(async () => { await handlers.onFinish({id: 'id-1'}); });
    expect(Speech.speak).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('playing');
  });

  it('retries the identical chunk once when it never starts, rather than failing immediately', async () => {
    jest.useFakeTimers();
    const onError = jest.fn();
    const {result} = renderHook(() => useArticleReader({onError}));
    await act(async () => { await result.current.start('Hello world.'); });
    expect(Speech.speak).toHaveBeenCalledTimes(1);
    // No onStart ever fires for id-1 - simulates the native isSpeaking-race
    // documented on START_TIMEOUT_MS: speak() resolved but nothing plays.

    await act(async () => { await jest.advanceTimersByTimeAsync(6000); });

    expect(Speech.stop).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled(); // one retry left before giving up
    expect(Speech.speak).toHaveBeenCalledTimes(2);
    expect(Speech.speak).toHaveBeenNthCalledWith(2, 'Hello world.'); // same chunk, not the next one
    expect(result.current.status).toBe('playing'); // still trying, not failed
    expect(result.current.isBuffering).toBe(true);
    jest.useRealTimers();
  });

  it('a second timeout even after the retry is treated as a genuine failure', async () => {
    jest.useFakeTimers();
    const onError = jest.fn();
    const {result} = renderHook(() => useArticleReader({onError}));
    await act(async () => { await result.current.start('Hello world.'); });
    await act(async () => { await jest.advanceTimersByTimeAsync(6000); }); // first timeout -> retries
    await act(async () => { await jest.advanceTimersByTimeAsync(6000); }); // second timeout, already retried once

    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
    expect(result.current.isBuffering).toBe(false);
    jest.useRealTimers();
  });

  it('a chunk that starts on retry gets its own fresh retry allowance for the next chunk', async () => {
    jest.useFakeTimers();
    const longText = 'A sentence. '.repeat(400); // well over the 3500-char chunk size - two real chunks
    const {result} = renderHook(() => useArticleReader());
    await act(async () => { await result.current.start(longText); });
    await act(async () => { await jest.advanceTimersByTimeAsync(6000); }); // chunk 1's first attempt times out, retries
    act(() => { handlers.onStart({id: 'id-2'}); }); // the retry itself genuinely starts
    expect(result.current.status).toBe('playing');
    expect(result.current.isBuffering).toBe(false);

    // onFinish advances to a second speakChunk() call for the next chunk -
    // simulate IT also needing a retry, to confirm the allowance reset.
    await act(async () => { await handlers.onFinish({id: 'id-2'}); });
    expect(Speech.speak).toHaveBeenCalledTimes(3);
    await act(async () => { await jest.advanceTimersByTimeAsync(6000); });
    expect(Speech.speak).toHaveBeenCalledTimes(4); // retried again, not failed
    expect(result.current.status).toBe('playing');
    jest.useRealTimers();
  });

  it('togglePause() pauses while playing', async () => {
    const {result} = renderHook(() => useArticleReader());
    await act(async () => { await result.current.start('Hello world.'); });
    await act(async () => { await result.current.togglePause(); });
    expect(Speech.pause).toHaveBeenCalled();
    expect(result.current.status).toBe('paused');
  });

  it('togglePause() resumes while paused', async () => {
    const {result} = renderHook(() => useArticleReader());
    await act(async () => { await result.current.start('Hello world.'); });
    await act(async () => { await result.current.togglePause(); }); // -> paused
    await act(async () => { await result.current.togglePause(); }); // -> playing
    expect(Speech.resume).toHaveBeenCalled();
    expect(result.current.status).toBe('playing');
  });

  it('stays playing if the native pause() reports nothing to pause', async () => {
    const {result} = renderHook(() => useArticleReader());
    await act(async () => { await result.current.start('Hello world.'); });
    Speech.pause.mockResolvedValueOnce(false);
    await act(async () => { await result.current.togglePause(); });
    expect(result.current.status).toBe('playing');
  });

  it('stop() stops the engine, clears any pending start timeout, resets buffering and returns to idle', async () => {
    jest.useFakeTimers();
    const onError = jest.fn();
    const {result} = renderHook(() => useArticleReader({onError}));
    await act(async () => { await result.current.start('Hello world.'); });
    expect(result.current.isBuffering).toBe(true); // onStart never fired
    act(() => { result.current.stop(); });
    expect(Speech.stop).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.isBuffering).toBe(false);

    // The start timeout that would have fired for the stopped utterance
    // must not still fire and report a failure after the fact.
    await act(async () => { await jest.advanceTimersByTimeAsync(6000); });
    expect(onError).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('start() right after stop() waits for the native stop to actually finish before speaking again', async () => {
    const {result} = renderHook(() => useArticleReader());
    await act(async () => { await result.current.start('Hello world.'); });
    Speech.speak.mockClear();

    // Speech.stop() only resolves once resolveNativeStop() is called below -
    // simulates the real native call still being in flight when the next
    // start() is fired, e.g. Stop then Listen tapped in quick succession.
    let resolveNativeStop;
    Speech.stop.mockReturnValueOnce(new Promise(res => { resolveNativeStop = res; }));

    act(() => { result.current.stop(); });
    // Deliberately not wrapped in act() - start() suspends on the pending
    // stop before touching any state this test needs to inspect while it's
    // still in flight, so there's nothing here for act() to flush yet.
    const startPromise = result.current.start('Hello world.');

    // Give any wrongly-unguarded microtask a chance to run speak() early.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(Speech.speak).not.toHaveBeenCalled();

    resolveNativeStop();
    await act(async () => { await startPromise; });
    expect(Speech.speak).toHaveBeenCalledWith('Hello world.');
  });

  it('a finish event for a stale/superseded utterance id is ignored', async () => {
    const onFinish = jest.fn();
    const {result} = renderHook(() => useArticleReader({onFinish}));
    await act(async () => { await result.current.start('Hello world.'); });
    act(() => { result.current.stop(); });
    Speech.speak.mockClear();

    await act(async () => { await handlers.onFinish({id: 'id-1'}); }); // arrives after stop()
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('calls onError and returns to idle when the native engine errors directly', async () => {
    const onError = jest.fn();
    const {result} = renderHook(() => useArticleReader({onError}));
    await act(async () => { await result.current.start('Hello world.'); });
    await act(async () => { await handlers.onError({id: 'id-1'}); });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
  });

  it('calls onError and returns to idle when speak() itself rejects', async () => {
    Speech.speak.mockRejectedValueOnce(new Error('engine unavailable'));
    const onError = jest.fn();
    const {result} = renderHook(() => useArticleReader({onError}));
    await act(async () => { await result.current.start('Hello world.'); });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
  });

  it('stops the engine on unmount if still active', async () => {
    const {result, unmount} = renderHook(() => useArticleReader());
    await act(async () => { await result.current.start('Hello world.'); });
    unmount();
    expect(Speech.stop).toHaveBeenCalled();
  });
});
