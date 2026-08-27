import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Compass,
  Gamepad2,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';

import { Button } from './components/ui/button';

type Wall = 'top' | 'right' | 'bottom' | 'left';

export interface MazeCell {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export type Maze = MazeCell[][];

interface Point {
  x: number;
  y: number;
}

interface BallState extends Point {
  vx: number;
  vy: number;
}

interface MotionVector {
  x: number;
  y: number;
}

interface SensorMazeGameProps {
  onClose: () => void;
}

const WALLS: Record<Wall, Wall> = {
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  left: 'left',
};

const NEIGHBOURS: Array<{ row: number; column: number; wall: Wall; opposite: Wall }> = [
  { row: -1, column: 0, wall: WALLS.top, opposite: WALLS.bottom },
  { row: 0, column: 1, wall: WALLS.right, opposite: WALLS.left },
  { row: 1, column: 0, wall: WALLS.bottom, opposite: WALLS.top },
  { row: 0, column: -1, wall: WALLS.left, opposite: WALLS.right },
];

const BALL_RADIUS = 0.18;

export function mazeSizeForLevel(level: number): number {
  return Math.min(19, 7 + Math.max(0, level - 1) * 2);
}

export function mazeDifficultyLabel(level: number): string {
  if (level <= 1) return 'Easy';
  if (level === 2) return 'Steady';
  if (level === 3) return 'Tricky';
  if (level === 4) return 'Hard';
  if (level === 5) return 'Expert';
  return 'Master';
}

export function generateMaze(size: number): Maze {
  const maze = Array.from({ length: size }, () => (
    Array.from({ length: size }, () => ({
      top: true,
      right: true,
      bottom: true,
      left: true,
    }))
  ));
  const visited = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const stack: Array<{ row: number; column: number }> = [{ row: 0, column: 0 }];
  visited[0][0] = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const candidates = NEIGHBOURS
      .map((direction) => ({
        ...direction,
        row: current.row + direction.row,
        column: current.column + direction.column,
      }))
      .filter(({ row, column }) => row >= 0 && row < size && column >= 0 && column < size)
      .filter(({ row, column }) => !visited[row][column]);

    if (candidates.length === 0) {
      stack.pop();
      continue;
    }

    const next = candidates[Math.floor(Math.random() * candidates.length)];
    maze[current.row][current.column][next.wall] = false;
    maze[next.row][next.column][next.opposite] = false;
    visited[next.row][next.column] = true;
    stack.push({ row: next.row, column: next.column });
  }

  return maze;
}

export function readMotionVector(event: DeviceMotionEvent): MotionVector | null {
  const acceleration = event.accelerationIncludingGravity ?? event.acceleration;
  if (!acceleration || acceleration.x === null || acceleration.y === null) return null;

  const angle = getScreenAngle();
  let x = acceleration.x;
  let y = acceleration.y;

  if (angle === 90) {
    [x, y] = [acceleration.y, -acceleration.x];
  } else if (angle === 180) {
    [x, y] = [-acceleration.x, -acceleration.y];
  } else if (angle === 270) {
    [x, y] = [-acceleration.y, acceleration.x];
  }

  return {
    x: clamp(x / 3.8, -1, 1),
    y: clamp(y / 3.8, -1, 1),
  };
}

export function advanceBall(
  ball: BallState,
  maze: Maze,
  input: MotionVector,
  deltaSeconds: number,
  level: number,
): BallState {
  const delta = Math.min(deltaSeconds, 0.05);
  const size = maze.length;
  const acceleration = 4.3 + Math.min(1.2, Math.max(0, level - 1) * 0.12);
  const friction = Math.pow(0.82, delta * 60);
  const maxSpeed = 2.1 + Math.min(0.65, Math.max(0, level - 1) * 0.08);
  let vx = clamp((ball.vx + input.x * acceleration * delta) * friction, -maxSpeed, maxSpeed);
  let vy = clamp((ball.vy + input.y * acceleration * delta) * friction, -maxSpeed, maxSpeed);
  const x = resolveHorizontal(ball.x, ball.y, vx * delta, maze);
  if (x.collided) vx = 0;
  const y = resolveVertical(ball.y, x.position, vy * delta, maze);
  if (y.collided) vy = 0;

  return {
    x: clamp(x.position, BALL_RADIUS, size - BALL_RADIUS),
    y: clamp(y.position, BALL_RADIUS, size - BALL_RADIUS),
    vx,
    vy,
  };
}

export function isMazeComplete(ball: Point, size: number): boolean {
  const target = size - 0.5;
  return Math.hypot(ball.x - target, ball.y - target) < 0.34;
}

export function SensorMazeGame({ onClose }: SensorMazeGameProps) {
  const [level, setLevel] = useState(1);
  const [maze, setMaze] = useState<Maze>(() => generateMaze(mazeSizeForLevel(1)));
  const [ball, setBall] = useState<BallState>(() => createStartingBall());
  const [sensorState, setSensorState] = useState<'idle' | 'enabled' | 'denied' | 'unsupported'>('idle');
  const [sensorMessage, setSensorMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const inputRef = useRef<MotionVector>({ x: 0, y: 0 });
  const ballRef = useRef<BallState>(ball);
  const completedRef = useRef(false);

  const resetBall = useCallback(() => {
    const startingBall = createStartingBall();
    ballRef.current = startingBall;
    setBall(startingBall);
    setCompleted(false);
    completedRef.current = false;
  }, []);

  const nextMaze = useCallback(() => {
    const nextLevel = level + 1;
    setLevel(nextLevel);
    setMaze(generateMaze(mazeSizeForLevel(nextLevel)));
    resetBall();
  }, [level, resetBall]);

  const nudgeBall = useCallback((x: number, y: number) => {
    const nextBall = {
      ...ballRef.current,
      vx: clamp(ballRef.current.vx + x * 0.42, -2.8, 2.8),
      vy: clamp(ballRef.current.vy + y * 0.42, -2.8, 2.8),
    };
    ballRef.current = nextBall;
    setBall(nextBall);
  }, []);

  const enableMotion = useCallback(async () => {
    const motionEvent = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    } | undefined;

    if (!motionEvent) {
      setSensorState('unsupported');
      setSensorMessage('Motion sensors are not available here. Touch controls are ready below.');
      return;
    }

    try {
      const permission = motionEvent.requestPermission ? await motionEvent.requestPermission() : 'granted';
      if (permission === 'granted') {
        setSensorState('enabled');
        setSensorMessage('Tilt controls active. Hold your phone level, then roll the ball through the maze.');
      } else {
        setSensorState('denied');
        setSensorMessage('Motion access was denied. You can still use the touch controls.');
      }
    } catch {
      setSensorState('denied');
      setSensorMessage('Motion access could not be enabled. You can still use the touch controls.');
    }
  }, []);

  useEffect(() => {
    const handleMotion = (event: DeviceMotionEvent) => {
      const nextInput = readMotionVector(event);
      if (nextInput) inputRef.current = nextInput;
    };

    if (sensorState === 'enabled') {
      window.addEventListener('devicemotion', handleMotion);
    }

    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [sensorState]);

  useEffect(() => {
    const pressedKeys = new Set<string>();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'w', 'a', 's', 'd'].includes(event.key)) return;
      event.preventDefault();
      pressedKeys.add(event.key);
      inputRef.current = getKeyboardInput(pressedKeys);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      pressedKeys.delete(event.key);
      inputRef.current = getKeyboardInput(pressedKeys);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    let previousTime = performance.now();

    const tick = (time: number) => {
      const delta = (time - previousTime) / 1000;
      previousTime = time;
      if (!completedRef.current) {
        const nextBall = advanceBall(ballRef.current, maze, inputRef.current, delta, level);
        ballRef.current = nextBall;
        setBall(nextBall);
        if (isMazeComplete(nextBall, maze.length)) {
          completedRef.current = true;
          setCompleted(true);
        }
      }
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [level, maze]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const mazeStyle = {
    '--maze-size': maze.length,
    '--ball-x': `${(ball.x / maze.length) * 100}%`,
    '--ball-y': `${(ball.y / maze.length) * 100}%`,
  } as CSSProperties;

  return (
    <div className="sensor-maze-layer">
      <section aria-labelledby="sensor-maze-title" aria-modal="true" className="sensor-maze" role="dialog">
        <header className="sensor-maze__header">
          <div>
            <p className="eyebrow">Motion challenge</p>
            <h2 id="sensor-maze-title">Tilt maze</h2>
            <p>Level {level} · {mazeDifficultyLabel(level)} · {maze.length} × {maze.length}</p>
          </div>
          <Button aria-label="Close tilt maze" className="sensor-maze__close" onClick={onClose} type="button" variant="ghost">
            <X aria-hidden="true" size={19} />
          </Button>
        </header>

        <div className="sensor-maze__layout">
          <div className="sensor-maze__board-column">
            <div aria-label={`Level ${level} maze`} className="sensor-maze__board-shell">
              <div className="sensor-maze__board" style={mazeStyle}>
                {maze.flatMap((row, rowIndex) => row.map((cell, columnIndex) => (
                  <div
                    className={`sensor-maze__cell${rowIndex === 0 && columnIndex === 0 ? ' is-start' : ''}${rowIndex === maze.length - 1 && columnIndex === maze.length - 1 ? ' is-goal' : ''}`}
                    key={`${rowIndex}-${columnIndex}`}
                    style={{
                      '--wall-top': cell.top ? '1px' : '0',
                      '--wall-right': cell.right ? '1px' : '0',
                      '--wall-bottom': cell.bottom ? '1px' : '0',
                      '--wall-left': cell.left ? '1px' : '0',
                    } as CSSProperties}
                  >
                    {rowIndex === 0 && columnIndex === 0 ? <span className="sensor-maze__start-marker">START</span> : null}
                    {rowIndex === maze.length - 1 && columnIndex === maze.length - 1 ? <span className="sensor-maze__goal-marker"><Sparkles aria-hidden="true" size={15} /></span> : null}
                  </div>
                )))}
                <span aria-label="Ball" className="sensor-maze__ball" />
                {completed ? (
                  <div className="sensor-maze__complete" role="status">
                    <span className="sensor-maze__complete-icon"><Check aria-hidden="true" size={20} /></span>
                    <strong>Maze complete</strong>
                    <span>Level {level + 1} is ready.</span>
                    <Button onClick={nextMaze} type="button">Next maze</Button>
                  </div>
                ) : null}
              </div>
            </div>
            <div aria-label="Maze legend" className="sensor-maze__legend">
              <span><i className="sensor-maze__legend-dot is-start" />Start</span>
              <span><i className="sensor-maze__legend-dot is-goal" />Goal</span>
              <span><i className="sensor-maze__legend-dot is-ball" />Ball</span>
            </div>
          </div>

          <aside className="sensor-maze__controls-panel">
            <div className={`sensor-maze__sensor-card is-${sensorState}`}>
              <span className="sensor-maze__sensor-icon"><Compass aria-hidden="true" size={20} /></span>
              <div>
                <strong>{sensorState === 'enabled' ? 'Tilt controls active' : 'Use your phone to steer'}</strong>
                <p>{sensorMessage ?? 'Hold your phone level and tilt it gently to move the ball.'}</p>
              </div>
              {sensorState !== 'enabled' ? (
                <Button onClick={() => void enableMotion()} type="button" variant="secondary">
                  <Compass aria-hidden="true" size={16} />
                  Enable tilt controls
                </Button>
              ) : null}
            </div>

            <div aria-label="Touch controls" className="sensor-maze__d-pad">
              <button aria-label="Nudge ball up" onClick={() => nudgeBall(0, -1)} type="button"><ArrowUp aria-hidden="true" size={18} /></button>
              <button aria-label="Nudge ball left" onClick={() => nudgeBall(-1, 0)} type="button"><ArrowLeft aria-hidden="true" size={18} /></button>
              <span aria-hidden="true" className="sensor-maze__d-pad-center"><Gamepad2 size={15} /></span>
              <button aria-label="Nudge ball right" onClick={() => nudgeBall(1, 0)} type="button"><ArrowRight aria-hidden="true" size={18} /></button>
              <button aria-label="Nudge ball down" onClick={() => nudgeBall(0, 1)} type="button"><ArrowDown aria-hidden="true" size={18} /></button>
            </div>
            <p className="sensor-maze__control-hint">Touch controls give the ball a small push. Arrow keys and WASD also work.</p>

            <div className="sensor-maze__instructions">
              <div><span>01</span><p>Start at the green corner.</p></div>
              <div><span>02</span><p>Roll around the walls to reach the spark.</p></div>
              <div><span>03</span><p>Every completed maze adds two rows and columns.</p></div>
            </div>

            <Button className="sensor-maze__reset" onClick={resetBall} type="button" variant="ghost">
              <RotateCcw aria-hidden="true" size={16} />
              Reset maze
            </Button>
          </aside>
        </div>
      </section>
    </div>
  );
}

function createStartingBall(): BallState {
  return { x: 0.5, y: 0.5, vx: 0, vy: 0 };
}

function resolveHorizontal(position: number, otherPosition: number, delta: number, maze: Maze) {
  const size = maze.length;
  const row = clamp(Math.floor(otherPosition), 0, size - 1);
  const column = clamp(Math.floor(position), 0, size - 1);
  const nextPosition = position + delta;

  if (delta > 0 && nextPosition + BALL_RADIUS >= column + 1 && maze[row][column].right) {
    return { position: column + 1 - BALL_RADIUS, collided: true };
  }
  if (delta < 0 && nextPosition - BALL_RADIUS <= column && maze[row][column].left) {
    return { position: column + BALL_RADIUS, collided: true };
  }

  return { position: clamp(nextPosition, BALL_RADIUS, size - BALL_RADIUS), collided: false };
}

function resolveVertical(position: number, otherPosition: number, delta: number, maze: Maze) {
  const size = maze.length;
  const column = clamp(Math.floor(otherPosition), 0, size - 1);
  const row = clamp(Math.floor(position), 0, size - 1);
  const nextPosition = position + delta;

  if (delta > 0 && nextPosition + BALL_RADIUS >= row + 1 && maze[row][column].bottom) {
    return { position: row + 1 - BALL_RADIUS, collided: true };
  }
  if (delta < 0 && nextPosition - BALL_RADIUS <= row && maze[row][column].top) {
    return { position: row + BALL_RADIUS, collided: true };
  }

  return { position: clamp(nextPosition, BALL_RADIUS, size - BALL_RADIUS), collided: false };
}

function getKeyboardInput(keys: Set<string>): MotionVector {
  const right = keys.has('ArrowRight') || keys.has('d');
  const left = keys.has('ArrowLeft') || keys.has('a');
  const down = keys.has('ArrowDown') || keys.has('s');
  const up = keys.has('ArrowUp') || keys.has('w');
  return { x: Number(right) - Number(left), y: Number(down) - Number(up) };
}

function getScreenAngle(): number {
  const angle = window.screen.orientation?.angle ?? Number(window.orientation ?? 0);
  return ((angle % 360) + 360) % 360;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
