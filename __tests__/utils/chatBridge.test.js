import {requestOpenChat, onOpenChatRequest} from '../../src/utils/chatBridge';

// chatBridge's listener list is module-level state, not reset between tests
// by Jest - each test unsubscribes what it adds so an earlier test's listener
// can't still be attached (and get miscounted) by a later one.
describe('chatBridge', () => {
  let unsubscribers = [];

  function subscribe(fn) {
    const unsubscribe = onOpenChatRequest(fn);
    unsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  afterEach(() => {
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];
  });

  it('calls a subscribed listener when a request is made', () => {
    const listener = jest.fn();
    subscribe(listener);
    requestOpenChat();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies every subscribed listener', () => {
    const a = jest.fn();
    const b = jest.fn();
    subscribe(a);
    subscribe(b);
    requestOpenChat();
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it('stops notifying a listener after it unsubscribes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribe(listener);
    unsubscribe();
    requestOpenChat();
    expect(listener).not.toHaveBeenCalled();
  });

  it('is a no-op when there are no subscribers', () => {
    expect(() => requestOpenChat()).not.toThrow();
  });
});
