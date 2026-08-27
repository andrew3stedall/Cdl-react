import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  ACCOUNT_MOTION_GESTURE_STORAGE_KEY,
  createAccountMotionGestureDetector,
  getStoredAccountMotionGestureEnabled,
  setStoredAccountMotionGestureEnabled,
  type MotionEventLike,
} from './account-motion-gesture';

function motion(z: number): MotionEventLike {
  return { acceleration: { x: 0, y: 0, z } };
}

describe('account motion gesture', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('defaults to enabled and persists the device toggle', () => {
    expect(getStoredAccountMotionGestureEnabled()).toBe(true);

    setStoredAccountMotionGestureEnabled(false);

    expect(window.localStorage.getItem(ACCOUNT_MOTION_GESTURE_STORAGE_KEY)).toBe('false');
    expect(getStoredAccountMotionGestureEnabled()).toBe(false);
  });

  test('recognises two alternating forward/back cycles', () => {
    const onTrigger = vi.fn();
    const detector = createAccountMotionGestureDetector(onTrigger, (() => {
      let time = 0;
      return () => (time += 140);
    })());

    [7, 0, -7, 0, 7, 0, -7].forEach((value) => detector.handleMotion(motion(value)));

    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  test('ignores repeated movement in the same direction', () => {
    const onTrigger = vi.fn();
    const detector = createAccountMotionGestureDetector(onTrigger, (() => {
      let time = 0;
      return () => (time += 140);
    })());

    [7, 0, 7, 0, 7, 0, 7].forEach((value) => detector.handleMotion(motion(value)));

    expect(onTrigger).not.toHaveBeenCalled();
  });

  test('drops a sequence when the phone takes too long to reverse', () => {
    const onTrigger = vi.fn();
    const times = [140, 280, 1_280, 1_420, 1_560, 1_700, 1_840];
    let index = 0;
    const detector = createAccountMotionGestureDetector(onTrigger, () => times[index++]);

    [7, 0, -7, 0, 7, 0, -7].forEach((value) => detector.handleMotion(motion(value)));

    expect(onTrigger).not.toHaveBeenCalled();
  });
});
