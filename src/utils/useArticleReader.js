import {useState, useRef, useCallback, useEffect} from 'react';
import Speech from '@mhpdev/react-native-speech';

// Android's TextToSpeech engine refuses anything longer than
// Speech.maxInputLength per call (commonly ~4000 chars) - iOS has no such
// limit and reports Number.MAX_VALUE. Chunking unconditionally at a safe
// size keeps both platforms on one code path instead of branching, and
// keeps individual utterances short enough that pause/resume lands close to
// where the listener actually is rather than only at very sparse points.
const MAX_CHUNK = 3500;

// How long to wait for a chunk to actually start producing audio before
// treating it as stuck. Confirmed live (09-02) this genuinely happens even
// with a single deterministic local voice, dropped-network-voice-attempts
// aside: `@mhpdev/react-native-speech`'s Android speak() checks the native
// TextToSpeech engine's own `isSpeaking` flag to decide whether to actually
// dispatch a queued utterance, but that flag can still read stale right
// after a stop() - TextToSpeech is bound to a remote system service over
// Binder IPC and stop() can return before the service's own internal state
// has caught up. When that race hits, speak() still resolves with a valid
// utterance id (so nothing here can tell from the promise alone), but the
// item just sits queued forever with nothing to ever actually play it. One
// retry of the identical chunk, once this timeout fires with no onStart
// having happened, reliably clears it - by the time the retry runs, the
// stale state has settled. Only escalates to a real onError if that retry
// also times out, which would mean a genuinely broken voice rather than
// this specific race.
const START_TIMEOUT_MS = 6000;

// A "-network" voice (Google's cloud TTS) sounds dramatically more natural
// than a same-language "-local"/"-embedded" (always-offline) one, but is
// NOT a usable default here: repeated live testing showed it fails on the
// large majority of attempts and Android's own TTS service quietly
// substitutes ITS OWN fallback voice underneath - a different, uncontrolled
// identifier practically every time (en-gb-x-gbb-lstm-embedded one run,
// en-gb-x-gbb-seanet-embedded the next, en-gb-x-gba-local another) - before
// this app's own code ever gets a chance to act. That substitution isn't
// visible to Speech.onStart/onFinish as anything other than "the requested
// voice eventually started a bit late" so no pitch/voice tuning aimed at
// the network voice could ever reliably reach what actually gets heard.
// Deliberately going local-only instead - predictable and it's the voice
// the user actually tested and approved via the temporary Voice Lab tool.
//
// `quality` is a separate, unrelated trap worth remembering here too - it
// is not a usable signal for picking a better LOCAL voice either, since
// every installed voice reports "Enhanced" on Android regardless of actual
// tier (confirmed live: all 40 en-* voices on the same test device came
// back "Enhanced"). PREFERRED_VOICE_IDENTIFIER below is chosen by ear via
// Voice Lab specifically because of that, not derived from any queryable
// property.
const PREFERRED_VOICE_IDENTIFIER = 'en-gb-x-gbb-local';
const VOICE_PITCH = 1.0;
const VOICE_RATE = 1.0;

// Splits on a sentence boundary where possible so a pause/resume or a
// natural break between chunks never lands mid-sentence. Falls back to the
// nearest space, then a hard cut, for the rare case of one enormous
// sentence with no punctuation for thousands of characters.
function splitIntoChunks(text, maxLen) {
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf('. ', maxLen);
    if (cut < maxLen * 0.5) cut = remaining.lastIndexOf(' ', maxLen);
    if (cut <= 0) cut = maxLen;
    chunks.push(remaining.slice(0, cut + 1).trim());
    remaining = remaining.slice(cut + 1).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

// Resolves once to a single voice identifier: PREFERRED_VOICE_IDENTIFIER if
// the device actually has it, otherwise the first en-GB local/embedded
// voice, then any en-GB voice, then whatever's first - covers a device
// where that exact identifier doesn't exist (different manufacturer, OS
// version) without ever reaching for a network voice. On iOS none of this
// filtering vocabulary matches anything, so this resolves null and start()
// below simply leaves the OS's own default voice in place (already decent
// quality there, unlike Android's raw default), making the whole thing a
// no-op by design on that platform.
//
// Queried and cached once per app run, not per chunk/session - voice
// availability doesn't change mid-run, so there's no reason to re-ask.
let voiceCache; // undefined = not yet resolved; string identifier or null once resolved

async function resolveVoice() {
  if (voiceCache !== undefined) return voiceCache;
  try {
    const voices = await Speech.getAvailableVoices('en');
    const isGB = (v) => v.language?.toLowerCase() === 'en-gb';
    const local = voices.filter(v => v.identifier?.includes('local') || v.identifier?.includes('embedded'));
    const preferred = local.find(v => v.identifier === PREFERRED_VOICE_IDENTIFIER);
    voiceCache = (preferred || local.find(isGB) || local[0] || voices.find(isGB) || voices[0])?.identifier || null;
  } catch {
    voiceCache = null;
  }
  return voiceCache;
}

// Test-only: resets the module-level voice cache between tests.
// Deliberately not jest.resetModules() - that resets React's own module
// instance too, which breaks renderHook with an "Invalid hook call"-style
// failure the moment a reset-and-re-required hook tries to call useState
// against a dispatcher belonging to a different React instance than the one
// actually rendering it.
export function __resetVoiceStateForTests() {
  voiceCache = undefined;
}

// A small chunked-playback wrapper around @mhpdev/react-native-speech's
// single-utterance API. Callers just get start/togglePause/stop and a
// status - queuing the next chunk on each onFinish, matching events to the
// utterance that's actually still current (so a stale event from a chunk
// that's since been stopped/superseded can't corrupt playback) and telling
// natural completion apart from a native engine error via the
// onFinish/onError callbacks, is entirely internal here so ArticleScreen
// doesn't need to know any of it exists.
export function useArticleReader({onFinish, onError} = {}) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'playing' | 'paused'
  // True from the moment start() is called until audio genuinely begins
  // (Speech.onStart fires) or the attempt fails outright. Only tracked for
  // a fresh start(), not every chunk-to-chunk handoff within one article -
  // a voice that has already started once tends to start quickly again, so
  // re-flagging every chunk would just make the button flicker for no
  // benefit.
  const [isBuffering, setIsBuffering] = useState(false);
  const chunksRef = useRef([]);
  const indexRef = useRef(0);
  const activeRef = useRef(false);
  const utteranceIdRef = useRef(null);
  const startTimeoutRef = useRef(null);
  // Speech.stop() is genuinely async on the native side - tracking its
  // promise here lets a start() called shortly after a stop() (e.g. Stop
  // then Listen again, tapped in quick succession) wait for the engine to
  // actually finish stopping before dispatching a new speak(), rather than
  // racing a fresh utterance against a stop command that hasn't landed yet.
  const pendingStopRef = useRef(null);
  // Per-chunk, not per-session - reset on every genuine onStart so a later
  // chunk that hits the same issue still gets its own one retry rather than
  // inheriting an earlier chunk's used-up allowance. See START_TIMEOUT_MS.
  const retriedRef = useRef(false);

  const clearStartTimeout = useCallback(() => {
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }
  }, []);

  const speakChunk = useCallback(async () => {
    if (!activeRef.current) return;
    const chunks = chunksRef.current;
    const i = indexRef.current;
    if (i >= chunks.length) {
      activeRef.current = false;
      setStatus('idle');
      onFinish?.();
      return;
    }

    let id;
    try {
      id = await Speech.speak(chunks[i]);
    } catch {
      activeRef.current = false;
      setStatus('idle');
      setIsBuffering(false);
      onError?.();
      return;
    }
    if (!activeRef.current) return; // stopped while speak() was in flight

    utteranceIdRef.current = id;
    clearStartTimeout();
    startTimeoutRef.current = setTimeout(() => {
      if (!activeRef.current || utteranceIdRef.current !== id) return;
      Speech.stop().catch(() => {});
      if (!retriedRef.current) {
        // See the START_TIMEOUT_MS comment above - retry the identical
        // chunk once before giving up. By the time this runs, whatever
        // made the native isSpeaking check stale has very likely settled.
        retriedRef.current = true;
        speakChunk();
      } else {
        activeRef.current = false;
        setStatus('idle');
        setIsBuffering(false);
        onError?.();
      }
    }, START_TIMEOUT_MS);
  }, [onFinish, onError, clearStartTimeout]);

  useEffect(() => {
    const startSub = Speech.onStart(({id}) => {
      if (id !== utteranceIdRef.current) return;
      clearStartTimeout();
      setIsBuffering(false);
      retriedRef.current = false; // this chunk genuinely started - the next one gets its own fresh retry
    });
    const finishSub = Speech.onFinish(({id}) => {
      if (!activeRef.current || id !== utteranceIdRef.current) return;
      clearStartTimeout();
      indexRef.current += 1;
      speakChunk();
    });
    const errorSub = Speech.onError(({id}) => {
      if (!activeRef.current || id !== utteranceIdRef.current) return;
      clearStartTimeout();
      activeRef.current = false;
      setStatus('idle');
      setIsBuffering(false);
      onError?.();
    });
    return () => {
      startSub.remove();
      finishSub.remove();
      errorSub.remove();
      clearStartTimeout();
      if (activeRef.current) {
        activeRef.current = false;
        Speech.stop().catch(() => {});
      }
    };
  }, [speakChunk, onError, clearStartTimeout]);

  const start = useCallback(async (text) => {
    const plain = (text || '').trim();
    if (!plain) return;
    if (pendingStopRef.current) {
      await pendingStopRef.current;
      pendingStopRef.current = null;
    }
    const voice = await resolveVoice();
    if (voice) Speech.configure({voice, pitch: VOICE_PITCH, rate: VOICE_RATE});
    activeRef.current = true;
    chunksRef.current = splitIntoChunks(plain, Math.min(Speech.maxInputLength || MAX_CHUNK, MAX_CHUNK));
    indexRef.current = 0;
    retriedRef.current = false;
    setStatus('playing');
    setIsBuffering(true);
    speakChunk();
  }, [speakChunk]);

  const togglePause = useCallback(async () => {
    if (status === 'playing') {
      const paused = await Speech.pause().catch(() => false);
      if (paused) setStatus('paused');
    } else if (status === 'paused') {
      const resumed = await Speech.resume().catch(() => false);
      if (resumed) setStatus('playing');
    }
  }, [status]);

  const stop = useCallback(() => {
    if (!activeRef.current && status === 'idle') return;
    activeRef.current = false;
    clearStartTimeout();
    pendingStopRef.current = Speech.stop().catch(() => {});
    setStatus('idle');
    setIsBuffering(false);
  }, [status, clearStartTimeout]);

  return {status, isBuffering, start, togglePause, stop};
}
