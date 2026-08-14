/**
 * 방의 레이아웃. 시뮬레이션과 렌더러가 같은 숫자를 본다.
 * (측면 단면도 — 실제 사육장을 옆에서 보는 구조)
 *
 * ⚠️ 지금은 '모듈 = 격자 한 칸' 구조다.
 *    조각을 붙이면 벽이 사라지는 방식(shapes.ts)으로 옮기는 작업이 진행 중이고,
 *    그건 이 파일의 전제를 바꾸기 때문에 한 번에 갈아엎지 않고 단계로 나눈다.
 */

export const MODULE_W = 52;
export const MODULE_H = 41;

/**
 * ★ 격자 간격이 0이다 — 이게 '붙이면 벽이 사라진다'의 전제다.
 *
 *   딱 붙은 칸  → 벽이 없다. 공간이 이어진다.
 *   한 칸 띄움  → 그 빈 칸을 튜브가 지난다.
 *
 * 예전엔 칸 사이에 항상 틈이 있어서 무조건 튜브로만 이어졌다.
 * 틈을 없애니 '붙이기'와 '떼기'를 플레이어가 고를 수 있게 됐다.
 */
export const PITCH_X = MODULE_W;
export const PITCH_Y = MODULE_H;

/** 프레임 두께 */
export const WALL = 4;

/**
 * ★ 바닥재 깊이.
 *
 * 13이었다. 햄스터 키가 대략 30인데 톱밥이 13이면 **애초에 숨을 수가 없다.**
 * 굴을 파고 들어가는 건 햄스터가 하는 짓 중에 제일 햄스터다운 짓인데,
 * 그걸 표현할 물리적 여지가 없었던 것이다. 실제 사육장도 깊게 깐다.
 *
 * 이 값 하나로 바닥 높이가 정해지고, 가구·선반·사다리·바닥 그래프가 전부
 * groundY를 통해 따라온다. 그래서 여기만 바꾸면 된다.
 *
 * ★ 예전엔 이 숫자가 GROUND_OFF에도 따로 박혀 있었다. 두 곳에 같은 숫자가
 *   적혀 있으면 언젠가 반드시 어긋난다 — 한쪽만 고치는 날이 온다.
 */
export const SUBSTRATE_H = 26;

/** 모듈 안에서 바닥(햄스터 발) 높이 */
export const GROUND_OFF = MODULE_H - SUBSTRATE_H;

/**
 * 굴이 내려갈 수 있는 최대 깊이 (톱밥 표면 기준).
 * 바닥 유리에 닿기 전에 멈춰야 한다 — 굴이 사육장을 뚫으면 안 되니까.
 */
export const BURROW_MAX = SUBSTRATE_H - 4;
/**
 * 굴 입구 / 굴방의 폭.
 *
 * ★ 굴방은 햄스터보다 넉넉히 넓어야 한다. 처음에 32로 잡았더니 몸이 방을
 *   꽉 채워서 굴 벽이 한 픽셀도 안 보였고, 그러면 '굴에 들어가 있다'가 아니라
 *   '햄스터 모양으로 톱밥이 파였다'로 보인다. 구멍이 보이려면 구멍이 보여야 한다.
 */
export const BURROW_MOUTH_W = 20;
export const BURROW_ROOM_W = 46;

/** 햄스터가 돌아다닐 수 있는 모듈 내 로컬 x 범위 */
export const INNER_MIN = 7;
export const INNER_MAX = MODULE_W - 7;

/** 관 굵기 — 햄스터(약 30px)가 머리를 내놓지 않고 들어가야 한다 */
export const TUBE_H = 31;
export const TUBE_W = 27;

/**
 * ★ 관 높이는 한 칸을 넷으로 쪼갠 눈금에 맞춘다.
 *
 * 관을 바닥에만 붙일 수 있게 했더니 아무리 방을 예쁘게 놓아도
 * 관은 전부 같은 높이로 일자로만 지나갔다. 케이지가 예쁜 이유의 절반이
 * 여러 높이로 얽힌 관인데 그걸 없앤 셈이었다.
 *
 * rise 0~3이 한 칸 안의 눈금이고, 칸이 바뀌면 이어서 계속된다.
 * (rise 4 = 윗줄의 rise 0) 그래서 격자 전체가 하나의 연속된 높이 사다리가 된다.
 */
export const RISE_STEP = MODULE_H / 4;
export const MAX_RISE = 3;

/** 관 입구가 방 벽을 파고드는 깊이 */
export const MOUTH_IN = 12;
/** 입구 사다리가 방 안으로 들어와 있는 거리 (벽에 걸치면 안 되니까) */
export const LADDER_IN = 10;

/** 관 안쪽 바닥의 월드 y */
export const tubeFloorY = (cy: number, rise: number): number =>
  groundY(cy) - rise * RISE_STEP;

export interface Cell {
  cx: number;
  cy: number;
}

export const cellKey = (c: Cell): string => `${c.cx},${c.cy}`;
export const sameCell = (a: Cell, b: Cell): boolean => a.cx === b.cx && a.cy === b.cy;

export const originX = (cx: number): number => cx * PITCH_X;
export const originY = (cy: number): number => cy * PITCH_Y;

/** 그 줄의 바닥 y (월드 좌표) */
export const groundY = (cy: number): number => originY(cy) + GROUND_OFF;

/** 모듈 로컬 x → 월드 x */
export const worldX = (cx: number, localX: number): number => originX(cx) + localX;

/** 세로 튜브의 중심 x (모듈 가운데) */
export const shaftX = (cx: number): number => originX(cx) + MODULE_W / 2;

/** 격자 전체가 차지하는 월드 사각형 */
export function boundsOf(cells: readonly Cell[]): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (cells.length === 0) return { x: 0, y: 0, w: MODULE_W, h: MODULE_H };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of cells) {
    minX = Math.min(minX, originX(c.cx));
    minY = Math.min(minY, originY(c.cy));
    maxX = Math.max(maxX, originX(c.cx) + MODULE_W);
    maxY = Math.max(maxY, originY(c.cy) + MODULE_H);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** 책상은 화면 좌표에 고정된다 (카메라를 따라가지 않는다) */
export const DESK_SCREEN_Y = 152;

/**
 * ★ 사육장은 딱 하나, 크기도 고정이다.
 *
 * 방을 늘릴 수 있게 만들었다가 걷어냈다. 늘어나는 순간 전부가 변수가 된다 —
 * 벽이 어디서 사라지는지, 관이 어떻게 꺾이는지, 배경이 어디까지 밝은지,
 * 카메라가 얼마나 물러나는지. 최근에 고친 버그가 거의 다 거기서 나왔다.
 *
 * 한 칸짜리 방으로 못 박으면 그 변수가 전부 상수가 된다.
 * 이 게임이 재미있어야 하는 지점은 방을 넓히는 게 아니라 그 안에서 사는 것이었다.
 */
export const ROOM_COLS = 7;
export const ROOM_ROWS = 3;

/** 사육장 유리가 끝나는 높이 */
export const CAGE_BOTTOM = originY(ROOM_ROWS - 1) + MODULE_H;
/** 사육장 전체 폭 — 벽에 거는 물건이 어느 쪽 벽인지 판단할 때 쓴다 */
export const CAGE_W = ROOM_COLS * MODULE_W;

/**
 * 책상 상판의 월드 y.
 *
 * 유리 바로 밑이 아니라 한참 아래다 — 그 사이에 사육장 아래 가로대와
 * 사육장이 얹힌 널판이 들어간다. 여유를 안 두면 나무틀이 책상을 파고든다.
 */
export const DESK_Y = CAGE_BOTTOM + 20;

/**
 * ★ 책상선 위로 이만큼(월드 픽셀)은 보여야 '방'이 된다.
 *
 * 사육장 높이가 123, 거기서 책상까지 20 → 사육장 꼭대기가 이미 143이다.
 * 그 위로 벽에 걸린 것(시계·달력·창)이 앉을 자리가 더 필요하다.
 *
 * ★ 이 숫자가 왜 world.ts에 있냐면 — 카메라와 배경이 **같은 값**을
 *   봐야 하기 때문이다. 카메라는 이만큼을 화면에 담으려고 줌을 정하고,
 *   배경은 이 안에 벽 소품을 앉힌다.
 *
 *   두 군데서 따로 정하면 어떻게 되는지는 이미 겪었다. 폰을 눕히면
 *   화면이 낮아지는데 벽 소품 높이는 그대로라, 시계 윗부분이 잘렸다.
 *   같은 판단을 두 곳에서 하면 언젠가 반드시 어긋난다.
 */
export const ROOM_ABOVE_DESK = 200;
