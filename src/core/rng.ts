/**
 * 시드 기반 난수.
 *
 * 왜 Math.random을 안 쓰는가:
 * 이 게임의 상태는 이벤트 로그를 접어서(fold) 만든다. 같은 로그가 항상 같은
 * 상태를 만들어야 디버깅도 되고, 나중에 "그날 무슨 일이 있었는지" 재현도 된다.
 * 시드는 최초 실행 시 한 번 생성되어 세이브에 박힌다.
 */
export interface Rng {
  readonly seed: number;
  next(): number;
  range(min: number, max: number): number;
  int(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    seed,
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
  };
}

/** 최초 실행 시 한 번만 호출된다. */
export const makeSeed = (): number => (Math.random() * 0xffffffff) >>> 0;
