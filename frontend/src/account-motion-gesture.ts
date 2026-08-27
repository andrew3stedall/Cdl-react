import { useEffect, useRef } from 'react';

export const ACCOUNT_MOTION_GESTURE_STORAGE_KEY = 'cdl-account-motion-gesture-enabled';

const PEAK_THRESHOLD = 5.5;
const REARM_THRESHOLD = PEAK_THRESHOLD * 0.45;
const MIN_PEAK_INTERVAL_MS = 55;
const MAX_PEAK_INTERVAL_MS = 850;
const MAX_SEQUENCE_DURATION_MS = 2_600;
const TRIGGER_COOLDOWN_MS = 1_800;

type MotionAcceleration = {
  x: number | null;
  y: number | null;
  z: number | null;
};

export type MotionEventLike = {
  acceleration?: MotionAcceleration | null;
  accelerationIncludingGravity?: MotionAcceleration | null;
  timeStamp?: number;
};

export type MotionPermissionState = 'granted' | 'denied' | 'unsupported';

export function getStoredAccountMotionGestureEnabled(): boolean {
  if (typeof window === 'undefined') return true;

  try {
    return window.localStorage.getItem(ACCOUNT_MOTION_GESTURE_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setStoredAccountMotionGestureEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(ACCOUNT_MOTION_GESTURE_STORAGE_KEY, String(enabled));
  } catch {
    // Device storage can be unavailable in private browsing or restricted webviews.
  }
}

/**
 * Requests motion access when the browser exposes the iOS-style permission API.
 * Other browsers grant access by default once the listener is attached.
 */
export async function requestAccountMotionPermission(): Promise<MotionPermissionState> {
  if (typeof window === 'undefined') return 'unsupported';

  const motionEvent = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  } | undefined;

  if (!motionEvent) return 'unsupported';

  if (typeof motionEvent.requestPermission !== 'function') return 'granted';

  try {
    return (await motionEvent.requestPermission()) === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/**
 * Detects two deliberate forward/back cycles as four alternating acceleration
 * peaks on the phone's front-to-back axis. The callback fires once per gesture.
 */
export function createAccountMotionGestureDetector(
  onTrigger: () => void,
  now: () => number = () => performance.now(),
) {
  let baseline: number | null = null;
  let sequence: Array<{ sign: number; time: number }> = [];
  let armed = true;
  let lastTriggerAt = Number.NEGATIVE_INFINITY;

  const reset = () => {
    baseline = null;
    sequence = [];
    armed = true;
  };

  const handleMotion = (event: MotionEventLike) => {
    const sample = readForwardAcceleration(event, baseline);
    if (sample === null) return;
    baseline = sample.baseline;

    const time = typeof event.timeStamp === 'number' && Number.isFinite(event.timeStamp) && event.timeStamp > 0
      ? event.timeStamp
      : now();
    const signal = sample.signal;
    const magnitude = Math.abs(signal);

    if (magnitude <= REARM_THRESHOLD) {
      armed = true;
      return;
    }

    if (!armed || magnitude < PEAK_THRESHOLD) return;

    armed = false;
    const sign = Math.sign(signal);
    const previous = sequence[sequence.length - 1];

    if (!previous) {
      sequence = [{ sign, time }];
    } else {
      const interval = time - previous.time;
      const duration = time - sequence[0].time;

      if (
        interval < MIN_PEAK_INTERVAL_MS
        || interval > MAX_PEAK_INTERVAL_MS
        || duration > MAX_SEQUENCE_DURATION_MS
        || previous.sign === sign
      ) {
        sequence = [{ sign, time }];
      } else {
        sequence = [...sequence, { sign, time }];
      }
    }

    if (sequence.length === 4) {
      if (time - lastTriggerAt >= TRIGGER_COOLDOWN_MS) {
        lastTriggerAt = time;
        onTrigger();
      }
      sequence = [];
    }
  };

  return { handleMotion, reset };
}

export function useAccountMotionGesture({
  enabled,
  onTrigger,
}: {
  enabled: boolean;
  onTrigger: () => void;
}): void {
  const onTriggerRef = useRef(onTrigger);

  useEffect(() => {
    onTriggerRef.current = onTrigger;
  }, [onTrigger]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const detector = createAccountMotionGestureDetector(() => onTriggerRef.current());
    const handleMotion = (event: DeviceMotionEvent) => detector.handleMotion(event);

    window.addEventListener('devicemotion', handleMotion, { passive: true });
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      detector.reset();
    };
  }, [enabled]);
}

function readForwardAcceleration(
  event: MotionEventLike,
  currentBaseline: number | null,
): { signal: number; baseline: number | null } | null {
  const linearZ = event.acceleration?.z;
  if (typeof linearZ === 'number' && Number.isFinite(linearZ)) {
    return { signal: linearZ, baseline: currentBaseline };
  }

  const gravityZ = event.accelerationIncludingGravity?.z;
  if (typeof gravityZ !== 'number' || !Number.isFinite(gravityZ)) return null;

  // Including-gravity is the reliable fallback on Android Chrome. Remove its
  // slowly changing static component so only a sharp forward/back movement is
  // considered a gesture.
  const baseline = currentBaseline === null
    ? gravityZ
    : currentBaseline + (gravityZ - currentBaseline) * 0.06;
  return { signal: gravityZ - baseline, baseline };
}
