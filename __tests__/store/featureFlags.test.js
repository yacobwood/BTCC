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
    podcast_last_episode_url: '',
    update_available: true,
    update_min_version: 62,
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
    expect(getHook().podcast_last_episode_url).toBe('');
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

    expect(getHook().podcast_last_episode_url).toBe('');
  });
});
