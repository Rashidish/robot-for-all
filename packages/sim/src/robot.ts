// The cart: two wheels, motor calls → wheel speeds, sensor positions (spec §6).
// Screen coordinates: x right, y down; heading in degrees clockwise from east.
import type { Point } from './util';

export type Side = 'left' | 'right';

/** Distance between the wheels (mm). */
export const TRACK_MM = 100;
/** Radius of the cart for bumps (mm). */
export const RADIUS_MM = 60;
/** Speed at 100 % (mm per second). */
export const TOP_SPEED_MM_S = 200;
/** Whisker contact points: ahead of the axle, and to each side (mm). */
export const WHISKER_AHEAD_MM = 70;
export const WHISKER_SIDE_MM = 40;
/** Line sensors: ahead of the axle, and to each side (mm). */
export const LINE_AHEAD_MM = 50;
export const LINE_SIDE_MM = 20;
/** Fixed simulation step (ms). */
export const STEP_MS = 20;

export interface RobotState {
  x: number;
  y: number;
  /** Radians, clockwise from east. */
  heading: number;
}

/**
 * Move the cart by one step of `dtS` seconds with wheel speeds in mm/s.
 * v = (vL + vR) / 2; turn rate = (vL − vR) / track (left faster → turns right, clockwise).
 */
export function kinematicStep(s: RobotState, vL: number, vR: number, dtS: number): RobotState {
  const v = (vL + vR) / 2;
  const w = (vL - vR) / TRACK_MM;
  const mid = s.heading + (w * dtS) / 2;
  return {
    x: s.x + v * Math.cos(mid) * dtS,
    y: s.y + v * Math.sin(mid) * dtS,
    heading: s.heading + w * dtS
  };
}

/** A point on the cart, `ahead` mm forward of the axle and `side` mm to one side. */
export function bodyPoint(s: RobotState, ahead: number, side: Side, offset: number): Point {
  const fx = Math.cos(s.heading);
  const fy = Math.sin(s.heading);
  // Left of the heading is (fy, −fx) in screen coordinates.
  const k = side === 'left' ? offset : -offset;
  return { x: s.x + fx * ahead + fy * k, y: s.y + fy * ahead - fx * k };
}
