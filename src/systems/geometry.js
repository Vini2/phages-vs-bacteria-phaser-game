/**
 * @file src/systems/geometry.js
 * @author Vijini Mallawaarachchi <viji.mallawaarachchi@gmail.com>
 * @version 0.0.1
 * @description
 * Geometry/math helpers for the circular petri dish play area.
 *
 * Exports:
 * - randomPointInDish(center, radius):
 *   Returns a uniformly distributed random point inside a circle.
 *
 * - clampToDishPoint(center, radius, pointVec):
 *   Clamps a Phaser.Vector2 point to remain within the circle boundary.
 *
 * Notes:
 * - clampToDishPoint returns a Phaser.Math.Vector2
 * - randomPointInDish returns a plain object {x, y}
 */


export function randomPointInDish(center, radius) {
  const t = Math.random() * Math.PI * 2;
  const u = Math.random() + Math.random();
  const r = u > 1 ? 2 - u : u;
  return {
    x: center.x + Math.cos(t) * r * radius,
    y: center.y + Math.sin(t) * r * radius
  };
}

export function clampToDishPoint(center, radius, pointVec) {
  const to = pointVec.clone().subtract(center);
  if (to.length() <= radius) return pointVec;
  to.setLength(radius);
  return new Phaser.Math.Vector2(center.x + to.x, center.y + to.y);
}
