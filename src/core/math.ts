export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const invLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : clamp((v - a) / (b - a), 0, 1);

/**
 * 프레임레이트에 무관한 지수 감쇠 보간.
 * halfLife 초마다 남은 거리의 절반을 좁힌다.
 */
export const damp = (current: number, target: number, halfLife: number, dt: number): number =>
  target + (current - target) * Math.pow(2, -dt / halfLife);

/** 0..1 구간을 부드럽게 (양 끝의 속도가 0) */
export const smoothstep = (t: number): number => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

/** 튀어나왔다가 정착 — 정지 오버슛/스쿼시에 사용 */
export const overshoot = (t: number, amount = 1.7): number => {
  const x = clamp(t, 0, 1);
  return 1 + amount * Math.pow(1 - x, 2) * Math.sin(x * Math.PI * 2.2) * (1 - x);
};

/** 감쇠 스프링. [새 값, 새 속도] 반환 */
export const spring = (
  value: number,
  velocity: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): [number, number] => {
  const accel = (target - value) * stiffness - velocity * damping;
  const v = velocity + accel * dt;
  return [value + v * dt, v];
};
