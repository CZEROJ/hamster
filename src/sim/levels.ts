import { FURNITURE } from '../content/furniture';
import { groundY, INNER_MAX, INNER_MIN, originX, type Cell } from '../world';
import type { Habitat, PlacedFurniture } from './habitat';

/**
 * ★ 높이 레이어.
 *
 * 케이지의 만족감은 '넓이'가 아니라 '높이와 밀도'에서 온다.
 * 모든 게 바닥 한 줄에 놓이면 배치란 게 "왼쪽이냐 오른쪽이냐"밖에 없고,
 * 그래서 아무리 꾸며도 방이 달라진 느낌이 안 난다.
 *
 * 선반을 얹으면 같은 방이 세 배로 넓어진다. 그리고 배치가
 * "어디 둘까"에서 "어떻게 이어붙일까"로 바뀐다 — 그게 꾸미기의 실체다.
 *
 * 구조는 방-튜브 그래프와 똑같다. 층 = 노드, 사다리 = 간선.
 * 그 코드를 그대로 재사용한다.
 */

export interface Level {
  /** 그 방 안에서의 층 번호. 0은 항상 바닥. */
  id: number;
  /** 월드 y (햄스터의 발 높이) */
  y: number;
  /** 걸어 다닐 수 있는 로컬 x 범위 */
  x0: number;
  x1: number;
  /** 이 층을 만든 가구 (바닥은 null) */
  from: PlacedFurniture | null;
}

/** 한 칸(모듈) 안의 층들. 0번은 항상 바닥. */
export function levelsIn(hab: Habitat, cell: Cell): Level[] {
  const out: Level[] = [
    { id: 0, y: groundY(cell.cy), x0: INNER_MIN, x1: INNER_MAX, from: null },
  ];

  let id = 1;
  for (const f of hab.inCell(cell)) {
    const def = FURNITURE[f.id];
    if (!def.platform) continue;
    out.push({
      id: id++,
      y: groundY(cell.cy) - def.platform.height,
      x0: f.x + def.platform.x0,
      x1: f.x + def.platform.x1,
      from: f,
    });
  }
  return out;
}

/**
 * 두 층을 이어주는 사다리가 있는가.
 * @returns 오르내릴 수 있는 로컬 x, 없으면 null
 */
export function linkBetween(
  hab: Habitat,
  cell: Cell,
  a: Level,
  b: Level,
): number | null {
  const lo = Math.min(a.y, b.y);
  const hi = Math.max(a.y, b.y);

  for (const f of hab.inCell(cell)) {
    const def = FURNITURE[f.id];
    if (!def.climbHeight) continue;
    const top = groundY(cell.cy) - def.climbHeight;
    const bottom = groundY(cell.cy);
    // 사다리가 두 층의 높이를 모두 걸쳐야 한다
    if (top > lo + 2 || bottom < hi - 2) continue;

    const cx = f.x + def.w / 2;
    // 그리고 두 층 모두의 x 범위 안에 있어야 한다
    if (cx < a.x0 - 4 || cx > a.x1 + 4) continue;
    if (cx < b.x0 - 4 || cx > b.x1 + 4) continue;
    return cx;
  }
  return null;
}

/** 지금 서 있는 층 */
export function levelOf(levels: Level[], id: number): Level {
  return levels.find((l) => l.id === id) ?? levels[0]!;
}

/** 이 지점에서 제일 가까운 층 (가구를 놓거나 옮길 때 쓴다) */
export function levelAt(levels: Level[], localX: number, worldYish: number): Level {
  let best = levels[0]!;
  let bestD = Infinity;
  for (const l of levels) {
    if (localX < l.x0 - 6 || localX > l.x1 + 6) continue;
    const d = Math.abs(l.y - worldYish);
    if (d < bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

/** 층의 월드 x 중심 (렌더링·이동 목표용) */
export function levelWorldX(cell: Cell, localX: number): number {
  return originX(cell.cx) + localX;
}
