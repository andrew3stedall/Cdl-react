import { afterEach, describe, expect, test, vi } from 'vitest';

import { activateDataRoute, invalidateData, subscribeDataFreshness } from './data-freshness';

afterEach(() => {
  vi.useRealTimers();
  document.dispatchEvent(new Event('visibilitychange'));
});

describe('shared data freshness', () => {
  test('refreshes a route when it is activated again after another route mutates matching data', () => {
    const refresh = vi.fn();
    const unsubscribe = subscribeDataFreshness('market', ['squad', 'trade'], refresh, false);
    activateDataRoute('market');
    expect(refresh).toHaveBeenCalledTimes(1);

    activateDataRoute('squad');
    invalidateData(['trade'], 'squad');
    expect(refresh).toHaveBeenCalledTimes(1);
    activateDataRoute('market');
    expect(refresh).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  test('refreshes only the active page when the browser resumes', () => {
    const refresh = vi.fn();
    const unsubscribe = subscribeDataFreshness('league', ['league'], refresh, false);
    activateDataRoute('league');
    refresh.mockClear();

    window.dispatchEvent(new Event('online'));
    expect(refresh).toHaveBeenCalledTimes(1);
    activateDataRoute('market');
    window.dispatchEvent(new Event('online'));
    expect(refresh).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  test('polls the active visible page at a bounded interval and clears polling after unsubscribe', () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    const unsubscribe = subscribeDataFreshness('desk', ['alerts'], refresh, false);
    activateDataRoute('desk');
    refresh.mockClear();

    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    activateDataRoute('market');
    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    unsubscribe();
    activateDataRoute('desk');
    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('does not poll a background tab', () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    const refresh = vi.fn();
    const unsubscribe = subscribeDataFreshness('squad', ['squad'], refresh, false);
    activateDataRoute('squad');
    refresh.mockClear();

    vi.advanceTimersByTime(120_000);
    expect(refresh).not.toHaveBeenCalled();
    unsubscribe();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  });
});
