// Minimal pub/sub so code outside the component tree (notifNavigation.js,
// reached from a notification tap) can open the live chat sheet.
//
// ChatFab owns the chat Modal's `open` state locally - it isn't a
// react-navigation route, so `navigationRef.navigate('Chat')` can't reach
// it (that call was a dead branch; see notifNavigation.js). This gives
// ChatFab something to subscribe to instead, without pulling navigation
// concerns into a component that otherwise only reacts to feature flags,
// settings and the RTDB unread listener.
let listeners = [];

export function requestOpenChat() {
  listeners.forEach(fn => fn());
}

export function onOpenChatRequest(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(l => l !== fn); };
}
