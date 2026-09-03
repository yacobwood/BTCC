import {useEffect} from 'react';
import {CommonActions} from '@react-navigation/native';

// Hook for a stack's ROOT screen (not the stack wrapper - see history below)
// to pop its own stack back to root when its tab bar icon is pressed, and to
// scroll itself back to top either way. tabPress fires on every press of
// this tab's bar icon, whether or not it's already the active tab and
// whether or not the stack is already at its root - onTabPress always runs;
// the reset only additionally happens when there's actually a deeper stack
// to pop.
//
// Must be called from a screen INSIDE the stack (e.g. DriversScreen, not the
// DriversStack wrapper in AppNavigator.js that renders <Stack.Navigator>) -
// navigation.getParent() only reaches the tab navigator from a screen
// managed BY the stack navigator. Calling it from the wrapper instead (as
// this used to, as useResetStackOnTabPress) resolves `navigation` to the
// wrapper's own TAB-level nav (registered as Tab.Screen's component), whose
// getParent() has nothing above it - this silently no-ops forever, and
// separately whose getState() would return the tab navigator's own state (5
// routes, one per tab) rather than this stack's depth, meaning the
// routes.length check below would never see the real stack depth either.
// Both bugs went unnoticed for a long time because nothing in this app's
// test suite exercises real tabPress: jest.setup.js's global mock replaces
// addListener/getParent with no-ops everywhere, and the one place tabPress
// was mocked with real state (AppNavigator.test.js) implements its own
// simplified fake tab switching that never calls through to this code at
// all. Confirmed via a real, unmocked navigator test
// (__tests__/navigation/tabPressScrollReset.test.js) before landing this,
// specifically to stop guessing after two earlier wrong fixes (2026-08-30).
//
// This lives in its own file, not AppNavigator.js, so screens that need it
// (DriversScreen, CalendarScreen, MoreScreen, ResultsScreen) don't pull in
// AppNavigator.js's own imports of every other screen in the app - that
// circular-import shape is exactly what broke a first attempt at this.
export function useTabPressReset(navigation, onTabPress) {
  useEffect(() => {
    const tabNav = typeof navigation?.getParent === 'function' ? navigation.getParent() : null;
    if (!tabNav) return;
    const unsubscribe = tabNav.addListener('tabPress', () => {
      const state = navigation.getState();
      if (state && state.routes && state.routes.length > 1) {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{name: state.routes[0].name, params: state.routes[0].params}],
          })
        );
      }
      onTabPress();
    });
    return unsubscribe;
  }, [navigation, onTabPress]);
}
