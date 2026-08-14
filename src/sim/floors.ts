import { FURNITURE } from '../content/furniture';
import type { Habitat, PlacedFurniture } from './habitat';
import {
  groundY,
  INNER_MIN,
  MODULE_W,
  originX,
  type Cell,
} from '../world';

/**
 * ★ 바닥 그래프 — 이 파일이 '붙이면 벽이 사라진다'의 심장이다.
 *
 * 지금까지 '방', '층', '튜브'가 각각 따로 놀았다. 그런데 칸이 합쳐지기 시작하면
 * 그 셋의 경계가 무너진다. 두 칸이 붙으면 그건 방 하나인가 둘인가?
 *
 * 그래서 전부 하나로 합친다:
 *   바닥(Floor) = 걸어 다닐 수 있는 수평 선분 (월드 좌표)
 *   연결(Link)  = 그 선분들을 잇는 것 (사다리 / 튜브)
 *
 *   칸을 딱 붙이면  → 선분이 하나로 이어진다 (벽이 사라지고 넓어짐)
 *   한 칸 띄우면    → 선분이 둘이고 그 사이에 튜브 연결이 생긴다
 *   선반을 놓으면   → 위쪽에 선분이 하나 더 생긴다
 *
 * 셋 다 같은 자료구조라서 길찾기 코드 하나로 전부 해결된다.
 */

/**
 * ★ 바닥 번호는 '내용에서 나오는 이름'이어야 한다.
 *
 * 예전엔 만들어진 순서대로 0,1,2… 를 매겼다. 그런데 그래프를 매 프레임 새로 만들기
 * 때문에, 방을 하나 놓는 순간 앞쪽에 바닥이 끼어들면서 뒤쪽 번호가 전부 한 칸씩
 * 밀렸다. 햄스터는 자기가 선 바닥 번호를 들고 있으니, 그 번호가 갑자기 다른 바닥
 * (선반이나 관)을 가리켰다. 그래서 아무것도 없는 공중에 떠 있는 것처럼 보였다.
 *
 * 이름을 내용으로 만들면 배치가 바뀌어도 '그 바닥'은 계속 그 바닥이다.
 */
export type FloorId = string;

export interface Floor {
  id: FloorId;
  /** 월드 y (발 높이) */
  y: number;
  /** 걸어 다닐 수 있는 월드 x 범위 */
  x0: number;
  x1: number;
  /** 이 바닥에 걸쳐 있는 칸들 (바닥재·창고 판정용) */
  cells: Cell[];
  kind: 'ground' | 'shelf';
}

export interface Link {
  a: FloorId;
  b: FloorId;
  kind: 'ladder';
  /** 갈아타는 월드 x */
  x: number;
}

export interface FloorGraph {
  floors: Floor[];
  links: Link[];
}

/** 바닥 양 끝의 여유 (벽에 딱 붙지 않게) */
const EDGE = INNER_MIN;

/**
 * ★ 판자 하나가 차지하는 구간.
 *
 * 바닥 그래프(여기)와 그림(render/furniture)이 **같은 함수**로 판단해야 한다.
 * "이 둘은 이어진 판이다"를 두 곳에서 각자 계산하면 언젠가 어긋나고,
 * 그러면 다리는 사라졌는데 햄스터는 가운데서 멈추는(혹은 그 반대) 꼴이 난다.
 */
export interface Plank {
  y: number;
  x0: number;
  x1: number;
  cell: Cell;
  key: string;
}

/** 이만큼 벌어져 있어도 이어진 것으로 친다 — 딱 맞춰 놓기는 사람이 못 한다 */
export const JOIN_GAP = 6;

export function plankOf(f: PlacedFurniture): Plank | null {
  const def = FURNITURE[f.id];
  if (!def.platform) return null;
  return {
    y: groundY(f.cy) - (f.lift ?? 0) - def.platform.height,
    x0: originX(f.cx) + f.x + def.platform.x0,
    x1: originX(f.cx) + f.x + def.platform.x1,
    cell: { cx: f.cx, cy: f.cy },
    key: `s${f.cx},${f.cy},${Math.round(f.x)}`,
  };
}

/** a의 오른쪽 끝과 b의 왼쪽 끝이 맞닿아 있는가 (같은 높이일 때만) */
export const planksJoin = (a: Plank, b: Plank): boolean =>
  a.y === b.y && b.x0 >= a.x0 && b.x0 <= a.x1 + JOIN_GAP;

export function buildGraph(hab: Habitat): FloorGraph {
  const floors: Floor[] = [];

  // ── 1. 같은 줄에서 딱 붙어 있는 칸들을 하나의 바닥으로 ────
  //    단, '설 수 있는 칸'만이다. 아래에 칸이 또 있으면 거긴 벽 중간이지 바닥이 아니다.
  //    (한 칸이 41px밖에 안 돼서, 방 하나는 보통 세로 두 칸 이상을 차지한다)
  const rows = new Map<number, number[]>();
  for (const m of hab.modules) {
    if (!hab.standable(m)) continue;
    const r = rows.get(m.cy) ?? [];
    r.push(m.cx);
    rows.set(m.cy, r);
  }

  for (const [cy, cols] of rows) {
    cols.sort((a, b) => a - b);
    let run: number[] = [];
    const flush = (): void => {
      if (run.length === 0) return;
      const first = run[0]!;
      const last = run[run.length - 1]!;
      floors.push({
        // 왼쪽 끝 칸이 이 바닥의 이름이다 — 방을 더 붙여도 그 칸은 그 자리에 있다
        id: `g${first},${cy}`,
        y: groundY(cy),
        x0: originX(first) + EDGE,
        x1: originX(last) + MODULE_W - EDGE,
        cells: run.map((cx) => ({ cx, cy })),
        kind: 'ground',
      });
      run = [];
    };
    for (const cx of cols) {
      // 한 칸이라도 떨어져 있으면 다른 바닥이다
      if (run.length > 0 && cx !== run[run.length - 1]! + 1) flush();
      run.push(cx);
    }
    flush();
  }

  /**
   * ── 2. 선반이 만드는 바닥 ─────────────────────────
   *
   * ★ 나란히 붙인 선반은 하나로 이어진다.
   *
   * 방바닥 칸이 붙으면 벽이 사라지고 하나의 바닥이 되는 것과 같은 규칙이다
   * (위 1번). 같은 높이의 판이 맞닿으면 그건 판 두 개가 아니라 긴 판 하나다.
   * 그래야 햄스터가 가운데서 멈추지 않고 끝까지 걸어간다.
   *
   * 높이가 다르면 안 합쳐진다 — 선반(46)과 구름다리(26)는 서로 다른 층이다.
   * 여기서 y로 묶는 것 하나가 그 판단을 전부 해준다.
   */
  const planks = hab.furniture.map(plankOf).filter((p): p is Plank => p !== null);

  const byHeight = new Map<number, typeof planks>();
  for (const p of planks) {
    const row = byHeight.get(p.y) ?? [];
    row.push(p);
    byHeight.set(p.y, row);
  }

  for (const [y, row] of byHeight) {
    row.sort((a, b) => a.x0 - b.x0);
    let run = [row[0]!];
    const flush = (): void => {
      const first = run[0]!;
      floors.push({
        // 제일 왼쪽 판이 이 바닥의 이름이다 — 방바닥이 왼쪽 끝 칸을 쓰는 것과 같다
        id: first.key,
        y,
        x0: first.x0,
        x1: Math.max(...run.map((p) => p.x1)),
        cells: run.map((p) => p.cell),
        kind: 'shelf',
      });
    };
    for (const p of row.slice(1)) {
      const reach = Math.max(...run.map((q) => q.x1));
      if (p.x0 <= reach + JOIN_GAP) run.push(p);
      else {
        flush();
        run = [p];
      }
    }
    flush();
  }

  // ── 3. 연결 ──────────────────────────────────────
  const links: Link[] = [];

  /**
   * 갈아타는 x는 반드시 두 바닥 '모두' 위에 있어야 한다.
   *
   * 이동은 (link.x, 출발바닥.y) → (link.x, 도착바닥.y) 두 점을 걷는 걸로 만들어진다.
   * x가 어느 한쪽 바닥 밖이면 그 구간은 허공을 걷는 게 된다.
   * 연결을 만드는 자리마다 따로 확인하면 반드시 한 군데를 빠뜨리므로 여기서 막는다.
   */
  const link = (a: Floor, b: Floor, kind: Link['kind'], x: number): void => {
    if (a.id === b.id) return;
    if (x < a.x0 - 3 || x > a.x1 + 3) return;
    if (x < b.x0 - 3 || x > b.x1 + 3) return;
    links.push({ a: a.id, b: b.id, kind, x });
  };

  // 사다리 — 두 바닥의 높이를 모두 걸치고, x가 둘 다에 닿을 때
  for (const f of hab.furniture) {
    const def = FURNITURE[f.id];
    if (!def.climbHeight) continue;
    const base = groundY(f.cy);
    const cx = originX(f.cx) + f.x + def.w / 2;
    const top = base - def.climbHeight;

    for (const a of floors) {
      for (const b of floors) {
        if (a.id >= b.id) continue;
        const lo = Math.min(a.y, b.y);
        const hi = Math.max(a.y, b.y);
        if (top > lo + 3 || base < hi - 3) continue;
        link(a, b, 'ladder', cx);
      }
    }
  }

  // 방이 하나뿐이라 바닥은 '방바닥 하나 + 선반들'이고,
  // 그걸 잇는 건 사다리뿐이다. 관이 있던 자리가 여기였다.

  return { floors, links };
}

export function floorById(g: FloorGraph, id: FloorId): Floor | undefined {
  return g.floors.find((f) => f.id === id);
}

/** 이 지점에 제일 가까운 바닥 */
export function floorAt(g: FloorGraph, wx: number, wy: number): Floor | null {
  let best: Floor | null = null;
  let bestD = 60;
  for (const f of g.floors) {
    if (wx < f.x0 - 10 || wx > f.x1 + 10) continue;
    const d = Math.abs(f.y - wy);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

/** 가구가 놓인 바닥 */
export function floorOfFurniture(g: FloorGraph, f: PlacedFurniture): Floor | null {
  const wx = originX(f.cx) + f.x + FURNITURE[f.id].w / 2;
  return floorAt(g, wx, groundY(f.cy));
}

/**
 * 여기서 갈 수 있는 모든 바닥.
 *
 * '옆에 이어진 바닥'만 보면 안 된다. 관이 Floor가 되면서 방과 방 사이에
 * 관 바닥이 한 칸 끼어들었기 때문에, 이웃만 보면 건너편 방이 안 보인다.
 * (실제로 이걸 놓쳐서 햄스터가 관을 안 타는 버그가 났다)
 */
export function reachableFrom(g: FloorGraph, from: FloorId): Set<FloorId> {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const l of g.links) {
      const next = l.a === cur ? l.b : l.b === cur ? l.a : null;
      if (next === null || seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

/** 바닥에서 바닥으로 가는 최단 경로. 그래프라 BFS면 충분하다. */
export function pathBetween(g: FloorGraph, from: FloorId, to: FloorId): Link[] {
  if (from === to) return [];
  const prev = new Map<FloorId, { link: Link; from: FloorId }>();
  const seen = new Set([from]);
  const queue = [from];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const l of g.links) {
      const next = l.a === cur ? l.b : l.b === cur ? l.a : null;
      if (next === null || seen.has(next)) continue;
      seen.add(next);
      prev.set(next, { link: l, from: cur });
      if (next === to) {
        const out: Link[] = [];
        let node = to;
        while (node !== from) {
          const step = prev.get(node)!;
          out.unshift(step.link);
          node = step.from;
        }
        return out;
      }
      queue.push(next);
    }
  }
  return [];
}
