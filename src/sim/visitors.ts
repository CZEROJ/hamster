import { GUEST_BREEDS, type BreedId } from '../content/breeds';
import { createRng } from '../core/rng';
import { dayKeyOf } from '../journal/facts';

/**
 * 손님 햄스터.
 *
 * ★ 이 시스템의 목적은 하나다: '내가 없을 때도 뭔가 일어났다'.
 *   그게 없으면 두 번째 접속에 "어제랑 똑같네"가 되고, 거기서 게임이 끝난다.
 *
 * ★ 그리고 손님은 절대 가족이 아니다. 날씨다.
 *   왔다가 간다. 이름이 없고, 일기를 쓰지 않고, 쓰다듬을 수 없다.
 *   내 햄스터는 하나뿐이고, 그건 영원히 안 바뀐다.
 *
 * 구현상 중요한 점: 손님은 '시뮬레이션'되지 않는다.
 * 날씨처럼 날짜+시드로 결정된다 → 앱을 꺼둔 동안에도 왔다 간 게 된다.
 * 백그라운드 실행도, 서버도 필요 없다.
 */

export interface VisitorSpec {
  id: string;
  breed: BreedId;
  /** epoch ms */
  from: number;
  to: number;
}

/** 하루에 오는 손님. 대부분 0~1마리, 가끔 2마리. */
export function visitorsOn(dayStartMs: number, seed: number): VisitorSpec[] {
  const key = dayKeyOf(dayStartMs);
  const rng = createRng(hash(key) ^ ((seed + 0x51ed) >>> 0));

  const roll = rng.next();
  const count = roll < 0.34 ? 0 : roll < 0.86 ? 1 : 2;
  if (count === 0) return [];

  const d = new Date(dayStartMs);
  const out: VisitorSpec[] = [];

  for (let i = 0; i < count; i++) {
    // 손님도 야행성이다. 대개 저녁~새벽에 온다.
    const startHour = rng.range(17, 26); // 26 = 다음날 새벽 2시
    const stayHours = rng.range(1.5, 5);

    const from = new Date(d);
    from.setHours(0, 0, 0, 0);
    const fromMs = from.getTime() + startHour * 3_600_000;

    out.push({
      id: `${key}-${i}`,
      breed: rng.pick(GUEST_BREEDS),
      from: fromMs,
      to: fromMs + stayHours * 3_600_000,
    });
  }
  return out;
}

/** 지금 이 순간 와 있는 손님들 */
export function activeVisitors(now: number, seed: number): VisitorSpec[] {
  // 어제 밤에 와서 아직 안 간 애도 잡아야 한다
  const yesterday = now - 86_400_000;
  return [...visitorsOn(yesterday, seed), ...visitorsOn(now, seed)].filter(
    (v) => now >= v.from && now < v.to,
  );
}

/** 그 하루 동안 다녀간 손님들 — 일기가 이걸 읽는다 */
export function visitorsDuring(t0: number, t1: number, seed: number): VisitorSpec[] {
  const yesterday = t0 - 86_400_000;
  return [...visitorsOn(yesterday, seed), ...visitorsOn(t0, seed)].filter(
    (v) => v.from < t1 && v.to > t0,
  );
}

/**
 * 내 햄스터가 이 손님을 어떻게 대하는가.
 * 품종별 선천적 성향 + 지금까지 만난 횟수로 결정된다.
 * (취향 시스템과 같은 문법 — 겪을수록 편해진다)
 */
export function affinityFor(breed: BreedId, seed: number, metCount: number): number {
  const r = createRng(hash(breed) ^ ((seed + 0x77) >>> 0));
  const innate = r.range(-0.35, 0.55);
  const familiarity = Math.min(0.45, metCount * 0.09);
  return innate + familiarity;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
