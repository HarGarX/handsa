import { describe, expect, it } from 'vitest';
import { pointAt, projectPointToSegment, unitNormal, wallAngle, wallLength } from '../segment';

describe('wallLength / wallAngle', () => {
  it('computes length of a 3-4-5 triangle segment', () => {
    expect(wallLength({ x: 0, y: 0 }, { x: 300, y: 400 })).toBeCloseTo(500, 9);
  });

  it('computes angle of a horizontal segment as 0', () => {
    expect(wallAngle({ x: 0, y: 0 }, { x: 100, y: 0 })).toBeCloseTo(0, 9);
  });
});

describe('pointAt', () => {
  it('returns the midpoint at t=0.5', () => {
    expect(pointAt({ x: 0, y: 0 }, { x: 100, y: 200 }, 0.5)).toEqual({ x: 50, y: 100 });
  });
});

describe('unitNormal', () => {
  it('is perpendicular to the segment direction', () => {
    const start = { x: 0, y: 0 };
    const end = { x: 10, y: 0 };
    const n = unitNormal(start, end);
    expect(n.x).toBeCloseTo(0, 9);
    expect(Math.abs(n.y)).toBeCloseTo(1, 9);
  });
});

describe('projectPointToSegment', () => {
  it('projects a perpendicular point onto the middle of the segment', () => {
    const proj = projectPointToSegment({ x: 50, y: 30 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(proj.point).toEqual({ x: 50, y: 0 });
    expect(proj.t).toBeCloseTo(0.5, 9);
    expect(proj.distance).toBeCloseTo(30, 9);
  });

  it('clamps to the start of the segment when the projection falls before it', () => {
    const proj = projectPointToSegment({ x: -50, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(proj.t).toBe(0);
    expect(proj.point).toEqual({ x: 0, y: 0 });
  });

  it('clamps to the end of the segment when the projection falls beyond it', () => {
    const proj = projectPointToSegment({ x: 150, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    expect(proj.t).toBe(1);
    expect(proj.point).toEqual({ x: 100, y: 0 });
  });
});
