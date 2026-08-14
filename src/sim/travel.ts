import { clamp } from '../core/math';
import { floorById, pathBetween, type FloorGraph, type FloorId } from './floors';
import type { Hamster, WorldCtx } from './types';

/**
 * 바닥에서 바닥으로 이동.
 *
 * 이 시스템의 감정적 핵심은 '햄스터가 튜브로 사라졌다가 반대편에서 튀어나오는 것'이다.
 * 실제 햄스터를 키워본 사람이면 그 장면 하나로 이 게임을 이해한다.
 *
 * 그래서 순간이동은 절대 없다. 느리더라도 반드시 관을 통과하고,
 * 통과하는 동안 계속 보인다. 기다림이 곧 기대다.
 *
 * ★ 칸이 붙어 있으면 애초에 '이동'이 아니다 — 그냥 걸어가면 된다.
 *   같은 바닥 선분이니까. 그게 '벽이 사라졌다'의 실질이다.
 */

/** 관 안 이동 속도 (월드 px/초). 걷기보다 살짝 느리다 — 좁으니까. */
const TUBE_SPEED = 26;
const WALK_SPEED = 30;

export function worldPos(h: Hamster): { x: number; y: number } {
  if (h.travel) {
    const a = h.travel.pts[h.travel.i];
    const b = h.travel.pts[h.travel.i + 1];
    if (a && b) {
      return { x: a.x + (b.x - a.x) * h.travel.t, y: a.y + (b.y - a.y) * h.travel.t };
    }
  }
  return { x: h.wx, y: h.floorY };
}

/** 지금 관이나 사다리 안에 있는가 */
export const inTransit = (h: Hamster): boolean => h.travel !== null;

/**
 * 다른 바닥으로 가는 경로를 짜서 출발한다.
 * @returns 출발했으면 true (같은 바닥이거나 길이 없으면 false)
 */
export function beginTravel(
  h: Hamster,
  g: FloorGraph,
  toFloor: FloorId,
  landX: number,
): boolean {
  if (h.floorId === toFloor) return false;
  const route = pathBetween(g, h.floorId, toFloor);
  if (route.length === 0) return false;

  const pts: { x: number; y: number }[] = [{ x: h.wx, y: h.floorY }];
  let cur = h.floorId;

  for (const link of route) {
    const next = link.a === cur ? link.b : link.a;
    const from = floorById(g, cur);
    const to = floorById(g, next);
    if (!from || !to) break;

    // 갈아타는 지점까지 걸어가서
    pts.push({ x: link.x, y: from.y });
    // 관을 지나거나 사다리를 오르내린다
    pts.push({ x: link.x, y: to.y });
    cur = next;
  }
  pts.push({ x: landX, y: floorById(g, toFloor)?.y ?? h.floorY });

  h.travel = { pts, i: 0, t: 0, floorId: toFloor, x: landX };
  h.moveTarget = null;
  h.vx = 0;
  return true;
}

/** @returns 이번 틱에 도착했으면 true */
export function updateTravel(h: Hamster, ctx: WorldCtx): boolean {
  const tr = h.travel;
  if (!tr) return false;

  const a = tr.pts[tr.i];
  const b = tr.pts[tr.i + 1];
  if (!a || !b) {
    finish(h, ctx);
    return true;
  }

  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const vertical = Math.abs(b.y - a.y) > 2;
  const speed = tr.i === 0 || tr.i === tr.pts.length - 2 ? WALK_SPEED : TUBE_SPEED;
  tr.t += len > 0.5 ? (speed * ctx.dt) / len : 1;

  if (Math.abs(b.x - a.x) > 1) h.facing = b.x > a.x ? 1 : -1;
  if (vertical) h.standTarget = 0.7; // 사다리를 탈 땐 몸을 세운다

  if (tr.i > 0 && ctx.rng.chance(ctx.dt * 4)) ctx.sound('step', 0.4);

  while (tr.t >= 1) {
    tr.t -= 1;
    tr.i++;
    if (tr.i >= tr.pts.length - 1) {
      finish(h, ctx);
      return true;
    }
  }
  return false;
}

/**
 * ★ 도착하는 순간 도착지의 바닥 정보까지 같이 받아와야 한다.
 *
 * 여기서 floorId만 바꾸고 끝냈더니 착지하는 순간 햄스터가 순간이동했다.
 * 한 틱의 순서가 이렇게 되어 있기 때문이다:
 *
 *   ① 바닥 확인 — 이때 floorId는 아직 '출발한 바닥'이라 floorY도 출발지 높이
 *   ② 행동 갱신 — 여기서 도착 처리가 일어나 floorId가 도착지로 바뀐다
 *   ③ wy = floorY — ①에서 정한 **출발지 높이**가 그대로 쓰인다
 *
 * 그래서 선반에 올라선 프레임에 몸은 바닥 높이에 있고, 내려선 프레임엔 몸이
 * 선반 높이에 남는다. 선반이 없는 x 자리라면 그게 곧 '공중에 떠 있는' 그림이다.
 * 다음 틱에 ①이 바로잡지만, 그 사이가 눈에 보인다.
 *
 * floorId를 바꾸는 곳에서 높이도 같이 바꾸면 어긋나는 순간 자체가 없어진다.
 * (도착지가 사라졌으면 다음 틱의 복구 코드가 받아준다)
 */
function finish(h: Hamster, ctx: WorldCtx): void {
  const tr = h.travel!;
  h.floorId = tr.floorId;
  h.travel = null;

  const to = floorById(ctx.graph, tr.floorId);
  if (to) {
    h.floorY = to.y;
    h.floorX0 = to.x0;
    h.floorX1 = to.x1;
    h.wx = clamp(tr.x, to.x0, to.x1);
  } else {
    h.wx = tr.x;
  }

  h.moveTarget = null;
  h.vx = 0;
  h.landSquash = 1;
  ctx.sound('rustle', 0.8);
}

/**
 * 목적지를 향해 나아간다 (다른 바닥이면 알아서 관을 탄다).
 * @returns 도착했으면 true
 */
export function pursue(h: Hamster, ctx: WorldCtx): boolean {
  if (!h.goal) return true;

  if (h.travel) {
    updateTravel(h, ctx);
    return false;
  }
  if (h.floorId !== h.goal.floorId) {
    if (!beginTravel(h, ctx.graph, h.goal.floorId, h.goal.x)) {
      h.goal = null; // 길이 없다 — 포기하고 하던 일을 한다
      return true;
    }
    return false;
  }
  if (h.moveTarget === null && Math.abs(h.wx - h.goal.x) > 3) h.moveTarget = h.goal.x;
  if (h.moveTarget === null) {
    h.goal = null;
    return true;
  }
  return false;
}
