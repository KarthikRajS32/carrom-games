import { Vector2, Entity, CoinState } from '../types';

export const distance = (p1: Vector2, p2: Vector2): number => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

export const normalize = (v: Vector2): Vector2 => {
  const mag = Math.sqrt(v.x * v.x + v.y * v.y);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: v.x / mag, y: v.y / mag };
};

export const dot = (v1: Vector2, v2: Vector2): number => {
  return v1.x * v2.x + v1.y * v2.y;
};

export const subtract = (v1: Vector2, v2: Vector2): Vector2 => {
  return { x: v1.x - v2.x, y: v1.y - v2.y };
};

export const add = (v1: Vector2, v2: Vector2): Vector2 => {
  return { x: v1.x + v2.x, y: v1.y + v2.y };
};

export const scale = (v: Vector2, s: number): Vector2 => {
  return { x: v.x * s, y: v.y * s };
};

// Elastic collision resolution between two circles
export const resolveCollision = (e1: Entity, e2: Entity) => {
  const dx = e2.pos.x - e1.pos.x;
  const dy = e2.pos.y - e1.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < e1.radius + e2.radius) {
    // Normal vector
    const nx = dx / dist;
    const ny = dy / dist;

    // Relative velocity
    const dvx = e2.vel.x - e1.vel.x;
    const dvy = e2.vel.y - e1.vel.y;

    // Velocity along normal
    const velAlongNormal = dvx * nx + dvy * ny;

    // Do not resolve if velocities are separating
    if (velAlongNormal > 0) return;

    // Restitution (elasticity)
    const e = 0.8; // Hard wood/plastic collision

    // Impulse scalar
    let j = -(1 + e) * velAlongNormal;
    j /= (1 / e1.mass + 1 / e2.mass);

    // Impulse vector
    const impulseX = j * nx;
    const impulseY = j * ny;

    // Apply impulse
    e1.vel.x -= (1 / e1.mass) * impulseX;
    e1.vel.y -= (1 / e1.mass) * impulseY;
    e2.vel.x += (1 / e2.mass) * impulseX;
    e2.vel.y += (1 / e2.mass) * impulseY;

    // Positional correction (prevent sticking)
    const percent = 0.2; // Penetration percentage to correct
    const slop = 0.01;
    const penetration = e1.radius + e2.radius - dist;
    if (penetration > slop) {
        const correctionMag = (Math.max(penetration - slop, 0) / (1 / e1.mass + 1 / e2.mass)) * percent;
        const cx = nx * correctionMag;
        const cy = ny * correctionMag;
        
        e1.pos.x -= cx * (1 / e1.mass);
        e1.pos.y -= cy * (1 / e1.mass);
        e2.pos.x += cx * (1 / e2.mass);
        e2.pos.y += cy * (1 / e2.mass);
    }
    
    return true; // Collision occurred
  }
  return false;
};
