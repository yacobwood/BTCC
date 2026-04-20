import React, {useState, useEffect, useCallback, useRef} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions} from 'react-native';
import {WebView} from 'react-native-webview';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Colors} from '../theme/colors';
import {Analytics} from '../utils/analytics';
import {useRadio} from '../store/radio';

const TOCA_URL = 'https://btcc.net/live/live-audio/';
const STATION_NAME = 'TOCA Live Radio';
const TIMEOUT_MS = 15000;

// Injected into the hidden WebView — intercepts XHR, fetch, and audio src
// to sniff the stream URL before the user ever sees a web player.
const INJECT_JS = `(function() {
  var sent = false;
  function send(url) {
    if (sent || !url || typeof url !== 'string') return;
    var l = url.toLowerCase();
    // Ignore obvious non-audio resources
    if (/\\.(js|css|png|jpg|gif|svg|woff2?|ico|json|xml|html)(\\?|$)/.test(l)) return;
    if (/google|facebook|gtm|doubleclick|analytics|cdn\\.jsdelivr|unpkg\\.com/.test(l)) return;
    // Match common live-stream URL patterns
    if (/\\.m3u8|\\.(mp3|aac|ogg|flac)(\\?|$)|\\/(?:stream|listen|live|radio|audio)(\\.|\\/|\\?|$)|:\\d{4}\\/(?!\\d{4})/.test(l)) {
      sent = true;
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'stream',url:url}));
    }
  }
  // XHR
  var xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m,u){ try{send(String(u));}catch(e){} return xhrOpen.apply(this,arguments); };
  // fetch
  var origFetch = window.fetch;
  window.fetch = function(i,o){ try{send(typeof i==='string'?i:(i&&i.url?i.url:''));}catch(e){} return origFetch.apply(this,arguments); };
  // HTMLMediaElement.src property
  try {
    var d = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'src');
    if(d&&d.set) Object.defineProperty(HTMLMediaElement.prototype,'src',{
      set:function(v){try{send(v);}catch(e){} return d.set.call(this,v);},
      get:d.get, configurable:true
    });
  } catch(e){}
  true;
})();`;

const PAUSE_JS = `(function(){
  document.querySelectorAll('audio,video').forEach(function(m){try{m.pause();m.src='';}catch(e){}});
  true;
})();`;

const {width: SW, height: SH} = Dimensions.get('window');

export default function TocaRadioScreen({navigation}) {
  const {play, stop, currentStation, isPlaying} = useRadio();
  const isTocaPlaying = currentStation === STATION_NAME && isPlaying;

  // If already playing from a previous visit, go straight to playing phase
  const [phase, setPhase] = useState(isTocaPlaying ? 'playing' : 'connecting');
  const webviewRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    Analytics.screen('toca_live_radio');
  }, []);

  useEffect(() => {
    if (phase === 'connecting') {
      timeoutRef.current = setTimeout(() => setPhase('fallback'), TIMEOUT_MS);
    }
    return () => clearTimeout(timeoutRef.current);
  }, [phase]);

  const onMessage = useCallback((e) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'stream' && msg.url) {
        clearTimeout(timeoutRef.current);
        // Silence the web player before handing off to native
        webviewRef.current?.injectJavaScript(PAUSE_JS);
        play({name: STATION_NAME, streamUrl: msg.url});
        setPhase('playing');
      }
    } catch {}
  }, [play]);

  const handleStop = () => {
    stop();
    navigation.goBack();
  };

  const handleRetry = () => {
    clearTimeout(timeoutRef.current);
    setPhase('connecting');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{padding: 4}} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>TOCA LIVE RADIO</Text>
        {isTocaPlaying && (
          <TouchableOpacity onPress={handleStop} style={styles.stopHeaderBtn} accessibilityRole="button" accessibilityLabel="Stop radio">
            <Icon name="stop" size={18} color={Colors.navy} />
          </TouchableOpacity>
        )}
      </View>

      {/* Connecting phase — hidden WebView sniffs stream URL */}
      {phase === 'connecting' && (
        <>
          <View style={styles.center}>
            <ActivityIndicator color={Colors.yellow} size="large" />
            <Text style={styles.connectingText}>Connecting to TOCA Radio...</Text>
          </View>
          <WebView
            ref={webviewRef}
            source={{uri: TOCA_URL}}
            injectedJavaScript={INJECT_JS}
            onMessage={onMessage}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            style={styles.hiddenWebView}
          />
        </>
      )}

      {/* Native now-playing UI */}
      {phase === 'playing' && (
        <View style={styles.center}>
          <View style={styles.radioIconWrap}>
            <Icon name="radio" size={52} color={Colors.yellow} />
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={styles.stationName}>TOCA Live Radio</Text>
          <Text style={styles.persistHint}>Audio continues when you navigate away</Text>
          <TouchableOpacity style={styles.stopBtn} onPress={handleStop} accessibilityRole="button" accessibilityLabel="Stop radio">
            <Icon name="stop" size={24} color={Colors.navy} />
            <Text style={styles.stopLabel}>STOP</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Fallback — show the web player if URL couldn't be captured */}
      {phase === 'fallback' && (
        <>
          <WebView
            ref={webviewRef}
            source={{uri: TOCA_URL}}
            injectedJavaScript={INJECT_JS}
            onMessage={onMessage}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            style={{flex: 1}}
          />
        </>
      )}

      {/* Error — shouldn't normally reach here but just in case */}
      {phase === 'error' && (
        <View style={styles.center}>
          <Icon name="signal-wifi-off" size={48} color={Colors.textSecondary} />
          <Text style={styles.errorText}>Could not connect to TOCA Radio</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} accessibilityRole="button" accessibilityLabel="Retry">
            <Text style={styles.retryLabel}>RETRY</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: Colors.background},
  header: {flexDirection: 'row', alignItems: 'center', paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12, gap: 8},
  headerTitle: {color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1, flex: 1},
  stopHeaderBtn: {width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.yellow, justifyContent: 'center', alignItems: 'center'},
  center: {flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 32},
  connectingText: {color: Colors.textSecondary, fontSize: 15, marginTop: 4},
  // Rendered off-screen so it loads fully but the user never sees it
  hiddenWebView: {position: 'absolute', width: SW, height: SH, top: -SH * 2, left: 0},
  radioIconWrap: {width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center'},
  liveBadge: {flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(220,0,0,0.15)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5},
  liveDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#e00000'},
  liveText: {color: '#e00000', fontSize: 12, fontWeight: '900', letterSpacing: 1},
  stationName: {color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center'},
  persistHint: {color: Colors.textSecondary, fontSize: 12, textAlign: 'center'},
  stopBtn: {flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.yellow, borderRadius: 24, paddingHorizontal: 28, paddingVertical: 13, marginTop: 8},
  stopLabel: {color: Colors.navy, fontSize: 14, fontWeight: '900', letterSpacing: 1},
  errorText: {color: Colors.textSecondary, fontSize: 15, textAlign: 'center'},
  retryBtn: {backgroundColor: Colors.card, borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10, marginTop: 4},
  retryLabel: {color: '#fff', fontSize: 14, fontWeight: '700'},
});
