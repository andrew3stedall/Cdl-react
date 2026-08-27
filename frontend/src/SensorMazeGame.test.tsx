import { describe, expect, test } from 'vitest';

import {
  advanceBall,
  generateMaze,
  isMazeComplete,
  mazeDifficultyLabel,
  mazeSizeForLevel,
  motionVectorFromGravity,
} from './SensorMazeGame';

describe('sensor maze', () => {
  test('generates a connected maze with matching shared walls', () => {
    const maze = generateMaze(9);
    const visited = new Set(['0,0']);
    const queue = [{ row: 0, column: 0 }];

    for (let row = 0; row < maze.length; row += 1) {
      for (let column = 0; column < maze.length; column += 1) {
        const cell = maze[row][column];
        if (column < maze.length - 1) {
          expect(cell.right).toBe(maze[row][column + 1].left);
        }
        if (row < maze.length - 1) {
          expect(cell.bottom).toBe(maze[row + 1][column].top);
        }
      }
    }

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      const cell = maze[current.row][current.column];
      const next = [
        { row: current.row - 1, column: current.column, open: !cell.top },
        { row: current.row, column: current.column + 1, open: !cell.right },
        { row: current.row + 1, column: current.column, open: !cell.bottom },
        { row: current.row, column: current.column - 1, open: !cell.left },
      ].filter(({ row, column, open }) => open && row >= 0 && row < maze.length && column >= 0 && column < maze.length);

      next.forEach(({ row, column }) => {
        const key = `${row},${column}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ row, column });
        }
      });
    }

    expect(visited.size).toBe(81);
    expect(maze[0][0].top).toBe(true);
    expect(maze[maze.length - 1][maze.length - 1].bottom).toBe(true);
  });

  test('increases the maze dimensions as levels are completed', () => {
    expect(mazeSizeForLevel(1)).toBe(7);
    expect(mazeSizeForLevel(2)).toBe(9);
    expect(mazeSizeForLevel(5)).toBe(15);
    expect(mazeSizeForLevel(20)).toBe(19);
    expect(mazeDifficultyLabel(1)).toBe('Easy');
    expect(mazeDifficultyLabel(6)).toBe('Master');
  });

  test('moves the ball through an open cell and recognises the goal', () => {
    const maze = generateMaze(1);
    const ball = advanceBall(
      { x: 0.5, y: 0.5, vx: 0, vy: 0 },
      maze,
      { x: 1, y: 1 },
      0.016,
      1,
    );

    expect(ball.x).toBeGreaterThan(0.5);
    expect(ball.y).toBeGreaterThan(0.5);
    expect(isMazeComplete({ x: 0.5, y: 0.5 }, 1)).toBe(true);
  });

  test('corrects Android lateral direction after screen rotation', () => {
    const androidVector = motionVectorFromGravity(4.905, 0, 8.5, 0, 'android');
    const otherVector = motionVectorFromGravity(4.905, 0, 8.5, 0, 'other');

    expect(androidVector.x).toBeLessThan(0);
    expect(otherVector.x).toBeGreaterThan(0);
    expect(androidVector.y).toBe(0);
  });

  test('builds speed over time and responds more strongly to a larger tilt', () => {
    const maze = generateMaze(1);
    const gentleTilt = advanceBall({ x: 0.5, y: 0.5, vx: 0, vy: 0 }, maze, { x: 0.2, y: 0 }, 0.016, 1);
    const continuedGentleTilt = advanceBall(gentleTilt, maze, { x: 0.2, y: 0 }, 0.016, 1);
    const steepTilt = advanceBall({ x: 0.5, y: 0.5, vx: 0, vy: 0 }, maze, { x: 0.8, y: 0 }, 0.016, 1);

    expect(continuedGentleTilt.vx).toBeGreaterThan(gentleTilt.vx);
    expect(steepTilt.vx).toBeGreaterThan(gentleTilt.vx);
  });
});
