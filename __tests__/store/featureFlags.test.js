import React from 'react';
import {act, create} from 'react-test-renderer';
import {FeatureFlagsProvider, useFeatureFlags} from '../../src/store/featureFlags';

function renderProvider() {
  let hook;
  function Tester() {
    hook = useFeatureFlags();
    return null;
  }
  create(
    <FeatureFlagsProvider>
      <Tester />
    </FeatureFlagsProvider>
  );
  return () => hook;
}

describe('FeatureFlagsProvider', () => {
  const defaults = {
    podcasts_enabled: false,
    update_available: true,
    update_min_version_ios: 0,
    update_min_version_android: 63,
  };

  it('provides default flags immediately (before fetch resolves)', () => {
    let getHook;
    act(() => {
      getHook = renderProvider();
    });
    expect(getHook()).toMatchObject(defaults);
  });

  it('merges fetched flags with defaults', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({podcasts_enabled: true}),
    });

    let getHook;
    await act(async () => {
      getHook = renderProvider();
    });

    expect(getHook().podcasts_enabled).toBe(true);
    // Default fields still present
    expect(getHook().update_min_version_ios).toBe(0);
  });

  it('keeps defaults when fetch fails', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network error'));

    let getHook;
    await act(async () => {
      getHook = renderProvider();
    });

    expect(getHook()).toMatchObject(defaults);
  });

  it('keeps defaults when fetch returns non-ok response', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.reject(new Error('not json')),
    });

    let getHook;
    await act(async () => {
      getHook = renderProvider();
    });

    expect(getHook()).toMatchObject(defaults);
  });

  // ── live_chat version gate (hardcoded: build >= 68, applies on all platforms) ──

  it('live_chat is false when raw flag is true but build is below 68', async () => {
    const DeviceInfo = require('react-native-device-info').default;
    DeviceInfo.getBuildNumber.mockReturnValue('67');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({live_chat: true}),
    });
    let getHook;
    await act(async () => { getHook = renderProvider(); });
    expect(getHook().live_chat).toBe(false);
  });

  it('live_chat is true when raw flag is true and build is exactly 68', async () => {
    const DeviceInfo = require('react-native-device-info').default;
    DeviceInfo.getBuildNumber.mockReturnValue('68');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({live_chat: true}),
    });
    let getHook;
    await act(async () => { getHook = renderProvider(); });
    expect(getHook().live_chat).toBe(true);
  });

  it('live_chat is true when raw flag is true and build exceeds 68', async () => {
    const DeviceInfo = require('react-native-device-info').default;
    DeviceInfo.getBuildNumber.mockReturnValue('99');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({live_chat: true}),
    });
    let getHook;
    await act(async () => { getHook = renderProvider(); });
    expect(getHook().live_chat).toBe(true);
  });

  it('live_chat is false when raw flag is false regardless of build', async () => {
    const DeviceInfo = require('react-native-device-info').default;
    DeviceInfo.getBuildNumber.mockReturnValue('999');
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({live_chat: false}),
    });
    let getHook;
    await act(async () => { getHook = renderProvider(); });
    expect(getHook().live_chat).toBe(false);
  });

  it('does not overwrite existing defaults with undefined values from server', async () => {
    // Server returns only a partial flags object
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({podcasts_enabled: true}),
    });

    let getHook;
    await act(async () => {
      getHook = renderProvider();
    });

    expect(getHook().update_min_version_ios).toBe(0);
  });
});
