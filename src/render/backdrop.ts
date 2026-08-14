import { clamp } from '../core/math';
import type { Habitat } from '../sim/habitat';
import { type Season, type Weather } from '../sim/season';
import { CAGE_BOTTOM, CAGE_W, DESK_Y, MODULE_W, originX } from '../world';
import { VIEW_H } from './screen';

/**
 * 사육장이 놓인 '방'.
 *
 * ★ 집이 옆으로 뻗어나가면 방도 그만큼 드러난다.
 *   아직 닿지 않은 구간은 어둠 속에 잠겨 있다가, 집이 그쪽에 생기면 불이 들어온다.
 *
 *   안개(fog of war)가 아니라 '밤에 방 불을 하나씩 켜는 것'에 가깝게 만들었다.
 *   검게 가려버리면 즉시 게임 UI가 되고 코지가 깨진다. 어둑할 뿐 늘 거기 있어야 한다.
 *
 * 그리고 여기 놓이는 물건들은 장식이 아니다 — '사람이 산 흔적'이다.
 * 스탠드, 읽다 만 책, 머그컵, 액자, 달력.
 * 이게 있어야 이 사육장이 '그녀의 책상 위'에 있는 게 된다.
 */

/**
 * 배경 한 칸의 폭.
 *
 * ★ 케이지 격자(PITCH_X)에 묶으면 안 된다.
 *   격자를 절반으로 줄였더니 배경 소품 간격도 같이 절반이 됐고,
 *   거기에 벽 줄을 여러 층으로 늘리자 달력이 벽지가 됐다.
 *   방에 놓인 물건 사이 간격은 케이지 칸 크기와 아무 상관이 없다.
 */
export const SEG_W = 156;

export type Prop =
  | 'window'
  | 'lamp'
  | 'books'
  | 'plant'
  | 'photo'
  | 'calendar'
  | 'posterSun'
  | 'posterLeaf'
  | 'mug'
  | 'radio'
  | 'clock'
  | 'empty';

/**
 * ★ 무엇이 어디 놓이는지는 못박는다. 무작위로 안 뽑는다.
 *
 *   칸마다 따로 주사위를 굴리면 시계가 둘 걸리고 화분이 셋 놓인다.
 *   실제 방은 그렇게 안 생겼다 — 물건은 저마다 하나씩이고 자리가 정해져 있다.
 *   목록으로 못박으면 중복이 구조적으로 불가능하고, 배치를 직접 고를 수 있다.
 *
 *   사육장은 월드 x 0~312에 있다. 그 뒤(0·1번 칸)에는 벽에 걸리는 것만 두고,
 *   책상 물건은 양옆으로 비켜 놓는다 — 안 그러면 케이지에 가려서 안 보인다.
 */
const WALL_PLAN: Record<string, Prop> = {
  '0,1': 'window', // 케이지보다 한 층 위 — 창은 높이 달려야 바깥이 멀어 보인다
  '-1,0': 'posterSun',
  '2,0': 'posterLeaf',
  '-1,1': 'photo',
  '1,1': 'clock',
  '2,1': 'calendar',
};

/**
 * 창 높이만 줄 간격에서 뺀다.
 *
 * 벽 줄 간격이 80px이라 한 줄 옮기면 창이 너무 크게 뛴다 —
 * 아래 줄이면 케이지에 걸리고, 윗줄이면 천장까지 올라간다.
 * 창은 줄에 안 맞추고 그 사이 높이를 따로 잡는다.
 *
 * ★ 창은 사육장에 조금 물려야 한다.
 *
 * 지금까지 창 아랫변이 사육장 위쪽 20px 위에 딱 떨어져 떠 있었다. 그러면
 * 창과 사육장이 같은 평면에 붙은 스티커 두 장으로 보인다. 무언가에 **가려진**
 * 물건만이 '뒤에 있다'고 읽힌다 — 창 아랫부분을 사육장 뒤로 밀어넣으면
 * 벽·창·사육장이 세 겹으로 떨어진다. 크기도 키운다. 작은 창은 환기구지 창이 아니다.
 */
const WINDOW_W = 104;
const WINDOW_H = 86;
/**
 * ★ 창은 벽 줄이 아니라 사육장을 기준으로 잡혀 있다. 그래서 따로 내려야 한다.
 *
 * 창은 base-34에서 시작해 86만큼 내려온다 → 윗변이 책상선에서 211 위다.
 * 폰을 눕히면 책상 위로 보이는 게 200밖에 안 돼서 딱 이만큼 잘렸다.
 *
 * 벽 소품과 같은 비율로 누르면 안 된다 — 창 아랫변은 사육장 뒤로 물려야
 * '뒤에 있는 물건'으로 읽히는데, 같이 눌러버리면 사육장 안으로 통째로
 * 들어가서 아예 안 보인다. 윗변이 화면에 들어오는 데까지만 내린다.
 */
const WINDOW_Y = (): number => {
  // viewTop에는 이미 20px 여유가 붙어 있다(148행). 진짜 화면 끝은 그만큼 아래다.
  const avail = baseY - viewTop - 20;
  // 창 윗변은 base에서 39 위(-34에 테두리 5) → 여기에 여유 6을 더 둔다
  return baseY - Math.min(177, avail - 45);
};

/** 창이 어느 칸·어느 줄에 있는지 — 창빛이 따라다녀야 해서 한 군데서 찾는다 */
const WINDOW_AT = ((): { seg: number; row: number } => {
  const hit = Object.entries(WALL_PLAN).find(([, p]) => p === 'window');
  const [seg, row] = (hit?.[0] ?? '0,0').split(',').map(Number);
  return { seg: seg ?? 0, row: row ?? 0 };
})();

/**
 * 책상 물건은 월드 x를 직접 박는다.
 *
 * 칸 격자(156)에 묶어놨더니 사육장 폭(364)과 안 맞아떨어져서,
 * 화분이 화면 밖으로 밀리고 램프가 케이지에 겹쳤다.
 * 배경 칸은 벽을 칠하는 단위지 물건을 놓는 단위가 아니다.
 * 사육장이 x 0~364에 고정이니 그 양옆으로 손수 배치한다.
 */
const DESK_ITEMS: { x: number; prop: Prop }[] = [
  { x: -196, prop: 'radio' },
  { x: -120, prop: 'books' },
  { x: -66, prop: 'lamp' }, // 사육장 왼쪽 — 방의 주광원. 유리에 붙으면 빛이 번져서 안이 안 보인다
  { x: 402, prop: 'plant' }, // 사육장 바로 오른쪽
  { x: 470, prop: 'mug' },
];

/** 벽에 걸린 소품 */
function wallPropOf(seg: number, row: number, _seed: number): Prop {
  return WALL_PLAN[`${seg},${row}`] ?? 'empty';
}

/** 집이 닿은 범위 (월드 x) → 불이 켜진 구간 */
function litRange(hab: Habitat): { x0: number; x1: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const m of hab.modules) {
    x0 = Math.min(x0, originX(m.cx));
    x1 = Math.max(x1, originX(m.cx) + MODULE_W);
  }
  if (!Number.isFinite(x0)) return { x0: 0, x1: MODULE_W };
  return { x0, x1 };
}

/** 이 x가 얼마나 밝은가 (1 = 집이 닿은 곳, 0 = 저 멀리 어둠) */
function lightAt(x: number, r: { x0: number; x1: number }): number {
  const d = x < r.x0 ? r.x0 - x : x > r.x1 ? x - r.x1 : 0;
  return clamp(1 - d / FALLOFF, 0, 1);
}

/** 빛이 잦아드는 거리. 짧으면 무대 조명처럼 딱 잘려 보인다. */
const FALLOFF = 260;

export interface BackdropCtx {
  season: Season;
  weather: Weather;
  sky: string;
  time: number;
  /** 방 안 조명 (스탠드) 켜짐 정도 — 밤에 밝아진다 */
  lampWarmth: number;
}

/** 벽 + 소품. 카메라 변환 '안에서' 호출한다. */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  hab: Habitat,
  view: { left: number; right: number; top: number; bottom: number },
  c: BackdropCtx,
  seed: number,
): void {
  viewTop = view.top - 20;
  viewBottom = view.bottom + 20;
  viewSpan = view.right - view.left;
  const r = litRange(hab);
  const from = Math.floor(view.left / SEG_W) - 1;
  const to = Math.ceil(view.right / SEG_W) + 1;

  // 벽은 전부 '밝은 상태'로 칠하고, 어둠은 나중에 한 겹 덮는다.
  // 칸마다 밝다/어둡다를 정하면 그 경계가 칼자국처럼 남는다.
  for (let seg = from; seg <= to; seg++) {
    drawWallSegment(ctx, seg * SEG_W, c);
  }

  // 책상 위 소품
  for (const it of DESK_ITEMS) {
    const px = roomX(it.x);
    drawProp(ctx, px - SEG_W / 2, it.prop, lightAt(px, r), baseY, c);
  }

  // 벽에 걸린 소품 — 보이는 높이만 그린다
  wallRowsFor(view.top).forEach((y, row) => {
    if (y > view.bottom + 60 || y < view.top - 90) return;
    for (let seg = from; seg <= to; seg++) {
      const prop = wallPropOf(seg, row, seed);
      const px = roomX(seg * SEG_W + SEG_W / 2);
      drawProp(ctx, px - SEG_W / 2, prop, lightAt(px, r), y, c);
    }
  });

  // 빛 — 낮엔 창에서, 밤엔 스탠드에서. 물건보다 이게 아늑함을 만든다.
  drawWindowLight(ctx, c);
  drawLampGlow(ctx, r, c);

  // ★ 어둠 한 겹 — 집에서 멀어질수록 짙어진다.
  //   그라데이션 하나로 덮으니 경계가 없다. 안개가 아니라 '불빛이 닿는 데까지'다.
  const g = ctx.createLinearGradient(view.left, 0, view.right, 0);
  const span = Math.max(1, view.right - view.left);
  const stop = (x: number): number => clamp((x - view.left) / span, 0, 1);
  g.addColorStop(0, `rgba(16,12,10,${1 - lightAt(view.left, r) * 0.82})`);
  g.addColorStop(stop(r.x0 - FALLOFF), 'rgba(16,12,10,0.82)');
  g.addColorStop(stop(r.x0), 'rgba(16,12,10,0)');
  g.addColorStop(stop(r.x1), 'rgba(16,12,10,0)');
  g.addColorStop(stop(r.x1 + FALLOFF), 'rgba(16,12,10,0.82)');
  g.addColorStop(1, `rgba(16,12,10,${1 - lightAt(view.right, r) * 0.82})`);
  ctx.fillStyle = g;
  ctx.fillRect(view.left, wallTop(), span, wallBottom() - wallTop());
}

/**
 * ★ 세로 기준은 전부 상수다. 케이지가 커져도 방은 그대로 있어야 한다.
 *
 * 예전엔 케이지 범위에 맞춰 매 프레임 다시 잡았다. 그래서 위로 방을 하나 놓으면
 * 벽에 걸린 액자와 달력이 같이 올라갔다 — 그건 벽이 아니라 케이지의 장식이다.
 */
const baseY = DESK_Y;

/**
 * 벽 소품이 걸리는 높이들.
 *
 * 한 줄이 아니라 여러 줄인 게 중요하다. 처음엔 맨 아래 줄만 보이고,
 * 집을 위로 올릴수록 그 위의 벽이 드러난다. 집이 자라면서 방을 알아가는 셈이다.
 * (안 보이던 게 생기는 게 아니라, 늘 거기 있던 게 눈에 들어온다)
 */
const WALL_ROWS = [baseY - 152, baseY - 232, baseY - 312, baseY - 392];

/**
 * ★ 화면이 낮으면 벽 소품이 내려온다.
 *
 * 폰을 눕히면 책상 위로 보이는 방이 200 월드픽셀까지 줄어든다.
 * 시계는 232에 걸려 있으니 그냥 두면 화면 밖이다 — 실제로 잘렸었다.
 *
 * 여기서 방향이 두 갈래였다. 카메라를 더 빼서 방 전체를 보여주거나,
 * 방을 다시 앉히거나. 전자를 고르면 햄스터가 작아진다. 햄스터가 작아지는
 * 건 이 게임에서 제일 하면 안 되는 일이라 후자로 갔다.
 *
 * 잘라내는 게 아니라 **다시 앉히는** 것이다. 진짜 작은 방은 천장도 낮고,
 * 그런 방에서는 시계를 낮게 건다. 어색한 타협이 아니라 그냥 작은 방이다.
 *
 * 창문은 여기서 빼야 한다 — 창 높이(-177)는 벽 줄이 아니라 사육장
 * 꼭대기(-143)를 기준으로 잡은 값이라, 같이 눌러버리면 사육장 뒤로
 * 통째로 숨어서 아예 사라진다.
 */
function wallRowsFor(top: number): number[] {
  const avail = baseY - top; // 책상선 위로 실제 보이는 월드 높이
  const need = 232 + 26; // 시계가 걸린 줄 + 시계 몸통
  const squash = clamp(avail / need, 0.5, 1);
  if (squash >= 1) return WALL_ROWS; // 화면이 넉넉하면 손대지 않는다
  return WALL_ROWS.map((y) => baseY - (baseY - y) * squash);
}
// 벽은 화면에 보이는 세로 범위를 전부 덮는다 — 창을 키우면 벽도 그만큼 넓어진다
let viewTop = -200;
let viewBottom = 300;
let viewSpan = 600;

/**
 * ★ 좁은 화면에서는 방이 사육장 쪽으로 모인다. (세로 재구성의 가로 판)
 *
 * 방에 놓인 것들은 스탠드(-66)부터 머그(470)까지 536 넓이에 퍼져 있다.
 * 16:9 폰을 눕히면 보이는 폭이 455밖에 안 돼서, 양끝의 스탠드와 달력이
 * 화면 밖으로 잘려나갔다. 시계는 하루를 말하고 달력은 한 달을 말하는데
 * 달력만 반쪽이 나 있으면 방이 절름발이가 된다.
 *
 * ★ 이 함수를 **그림과 조명이 같이** 써야 한다.
 *   위치를 여기서만 정하지 않으면 '켜져 있는데 아무것도 안 밝히는 등'이
 *   조용히 생긴다. 벽등에서 이미 한 번 당했다.
 *
 * 화면이 넉넉하면 1을 곱하는 셈이라 아무 일도 일어나지 않는다.
 */
function roomX(x: number): number {
  const squash = clamp(viewSpan / 560, 0.75, 1);
  if (squash >= 1) return x;
  const mid = CAGE_W / 2;
  return mid + (x - mid) * squash;
}
const wallTop = () => viewTop;
const wallBottom = () => Math.min(viewBottom, baseY);

/**
 * 벽 — 한 장짜리 그라데이션 + 아주 옅은 세로줄.
 *
 * 허리 몰딩과 나무 판벽을 넣어봤다가 되돌렸다. 구조는 생겼는데 벽이 시끄러워졌고,
 * 벽은 물건이 걸릴 '바탕'이라 조용한 게 맞았다. 방을 만드는 건 벽이 아니라
 * 벽에 걸린 것들이다.
 */
function drawWallSegment(ctx: CanvasRenderingContext2D, x: number, _c: BackdropCtx): void {
  const top = wallTop();
  const bot = wallBottom();
  const w = SEG_W + 1;

  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, '#4a3322');
  g.addColorStop(0.6, '#3a2819');
  g.addColorStop(1, '#2b1f16');
  ctx.fillStyle = g;
  ctx.fillRect(x, top, w, bot - top);

  // 벽지 세로 줄 — 있는 줄 모르게
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#b88d5a';
  for (let i = 6; i < SEG_W; i += 15) ctx.fillRect(x + i, top, 3, bot - top);
  ctx.globalAlpha = 1;

  // 걸레받이
  ctx.fillStyle = '#7b5636';
  ctx.fillRect(x, baseY + 28, w, 4);
  ctx.fillStyle = 'rgba(255,220,180,0.08)';
  ctx.fillRect(x, baseY + 28, w, 1);
}

/**
 * 빈티지 포스터.
 *
 * 액자에 넣지 않고 종이째 붙인다 — 액자는 이미 사진이 하나 걸려 있고,
 * 같은 문법이 둘이면 방이 아니라 진열장이 된다.
 * 색은 바랜 인쇄물 쪽으로 낮게 깔았다. 벽에서 튀면 벽지를 이긴다.
 */
function drawPoster(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: 'sun' | 'leaf',
): void {
  const w = 34;
  const h = 46;
  const px = x - w / 2;

  // 종이 — 아래로 갈수록 살짝 그늘
  const pg = ctx.createLinearGradient(0, y, 0, y + h);
  pg.addColorStop(0, '#efe3c9');
  pg.addColorStop(1, '#ddccae');
  ctx.fillStyle = pg;
  ctx.fillRect(px, y, w, h);

  if (kind === 'sun') {
    // 지는 해 — 색 띠 세 겹에 동그라미 하나
    ctx.fillStyle = '#c98a5c';
    ctx.fillRect(px + 3, y + 20, w - 6, 8);
    ctx.fillStyle = '#b06a4a';
    ctx.fillRect(px + 3, y + 28, w - 6, 6);
    ctx.fillStyle = '#7e5a46';
    ctx.fillRect(px + 3, y + 34, w - 6, 5);
    ctx.fillStyle = '#e8b06a';
    ctx.beginPath();
    ctx.arc(x, y + 20, 6.5, Math.PI, Math.PI * 2);
    ctx.fill();
  } else {
    // 식물 도감 한 장 — 줄기와 잎 몇 장
    ctx.strokeStyle = '#6d7f52';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 36);
    ctx.lineTo(x, y + 12);
    ctx.stroke();
    ctx.fillStyle = '#7d9160';
    for (const [dy, dir] of [
      [16, -1],
      [22, 1],
      [28, -1],
    ] as const) {
      ctx.beginPath();
      ctx.ellipse(x + dir * 5, y + dy, 5, 2.6, dir * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 아래쪽 글씨 자리 — 읽히면 안 된다. 인쇄물이라는 힌트만.
  ctx.fillStyle = 'rgba(90,70,52,0.5)';
  ctx.fillRect(px + 7, y + h - 7, w - 14, 2);

  // 붙인 자국
  ctx.fillStyle = 'rgba(255,244,220,0.35)';
  ctx.fillRect(px + 2, y - 1, 6, 2);
  ctx.fillRect(px + w - 8, y - 1, 6, 2);
  // 종이 그림자
  ctx.fillStyle = 'rgba(24,14,10,0.28)';
  ctx.fillRect(px + 1, y + h, w, 2);
}

/**
 * 창에서 들어오는 빛줄기.
 *
 * 아늑함의 절반은 '빛이 어디서 오는지 보이는 것'이다. 방이 고르게 밝으면
 * 조명이 아니라 형광등이 되고, 그건 아늑함의 반대다.
 * 낮에만 뜨고, 밤에는 대신 스탠드가 그 역할을 한다.
 */
function drawWindowLight(ctx: CanvasRenderingContext2D, c: BackdropCtx): void {
  const day = 1 - c.lampWarmth;
  if (day < 0.08) return;

  /**
   * 아래로 뻗는 빛줄기를 그렸다가 지웠다 — 창이 사육장 바로 뒤에 있어서
   * 줄기가 내려갈 벽을 케이지가 통째로 가린다. 코드는 도는데 화면엔 안 보였다.
   * 대신 창 둘레로 번지게 했다. 케이지 위로 드러난 벽에 실제로 닿는다.
   */
  const cx = roomX(WINDOW_AT.seg * SEG_W + SEG_W / 2);
  const cy = WINDOW_Y() - 34 + WINDOW_H / 2; // 창 한가운데
  const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 210);
  g.addColorStop(0, `rgba(255,247,222,${0.26 * day})`);
  g.addColorStop(0.5, `rgba(255,243,212,${0.1 * day})`);
  g.addColorStop(1, 'rgba(255,243,212,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - 210, cy - 210, 420, 420);
}

/**
 * 켜진 조명마다 지는 따뜻한 빛 웅덩이.
 *
 * 광원 목록을 여기서 한 번에 만든다. 불빛을 그리는 곳과 조명을 놓는 곳이
 * 따로 놀면 '켜져 있는데 아무것도 안 밝히는 등'이 조용히 생긴다 —
 * 벽등이 실제로 그랬다.
 */
function drawLampGlow(
  ctx: CanvasRenderingContext2D,
  r: { x0: number; x1: number },
  c: BackdropCtx,
): void {
  if (c.lampWarmth < 0.05) return;

  const lights: { x: number; y: number; reach: number; power: number }[] = [];
  for (const it of DESK_ITEMS) {
    // 책상 스탠드 — 방의 주광원이라 멀리 간다
    if (it.prop === 'lamp') {
      // ★ roomX를 통과시켜야 한다 — 그림만 옮기면 등이 빈 벽을 밝힌다
      lights.push({ x: roomX(it.x) + 8, y: baseY - LAMP_H - 4, reach: 200, power: 0.22 });
    }
  }
  for (const l of lights) {
    const lit = lightAt(l.x, r);
    if (lit < 0.05) continue;
    const a = c.lampWarmth * lit * l.power;
    const g = ctx.createRadialGradient(l.x, l.y, 6, l.x, l.y, l.reach);
    g.addColorStop(0, `rgba(255,199,138,${a})`);
    g.addColorStop(0.55, `rgba(255,199,138,${a * 0.35})`);
    g.addColorStop(1, 'rgba(255,199,138,0)');
    ctx.fillStyle = g;
    ctx.fillRect(l.x - l.reach, l.y - l.reach, l.reach * 2, l.reach * 2);
  }
}

/**
 * 책상 상판 — 사육장이 놓인 면.
 *
 * ★ 화면에서 제일 넓은 면인데 예전엔 갈색 널판 한 장이었다.
 *   제일 넓은 면이 제일 밋밋하면 방 전체가 싸구려로 보인다.
 *   나뭇결 · 앞면 모서리 · 사육장 밑에 깐 천, 셋이면 충분하다.
 */
export function drawDeskSurface(
  ctx: CanvasRenderingContext2D,
  view: { left: number; right: number; top: number; bottom: number },
  hab: Habitat,
  c: BackdropCtx,
): void {
  const x = Math.floor(view.left) - 40;
  const w = view.right - view.left + 120;
  const deskH = Math.max(90, view.bottom - baseY + 40);
  const r = litRange(hab);

  // 상판 — 앞쪽으로 갈수록 어두워진다 (빛은 위에서 온다)
  const g = ctx.createLinearGradient(0, baseY, 0, baseY + 26);
  g.addColorStop(0, '#7b5636');
  g.addColorStop(1, '#5e402a');
  ctx.fillStyle = g;
  ctx.fillRect(x, baseY, w, 26);

  // 나뭇결 — 길고 불규칙한 가로줄. 규칙적이면 즉시 무늬가 된다.
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 26; i += 3) {
    const n = Math.sin(i * 12.9898) * 43758.5453;
    const jitter = (n - Math.floor(n)) * 2 - 1;
    ctx.fillStyle = jitter > 0 ? 'rgba(255,220,180,0.05)' : 'rgba(60,36,22,0.16)';
    ctx.fillRect(x, baseY + i + jitter, w, 1);
  }
  ctx.globalAlpha = 1;

  // 상판 윗면 하이라이트 — 여기가 '면이 꺾이는 곳'이다
  ctx.fillStyle = 'rgba(184,141,90,0.5)';
  ctx.fillRect(x, baseY, w, 1);

  // 앞면 모서리와 그 아래 (책상 옆판)
  ctx.fillStyle = '#4a3322';
  ctx.fillRect(x, baseY + 26, w, deskH - 26);
  ctx.fillStyle = 'rgba(255,224,186,0.1)';
  ctx.fillRect(x, baseY + 26, w, 1);
  ctx.fillStyle = 'rgba(30,18,12,0.18)';
  ctx.fillRect(x, baseY + 30, w, deskH - 30);

  /**
   * ★ 사육장이 얹힌 널판.
   *
   * 레퍼런스에서 수조가 바로 책상에 놓여 있지 않고 판자 하나 위에 올라가 있다.
   * 그 판자가 하는 일이 크다 — 수조가 책상에 파묻히지 않고 '올려놓은 물건'이 되고,
   * 판자 밑 그림자가 생기면서 앞뒤 거리가 한 겹 더 생긴다.
   */
  const pad = 20;
  const px = r.x0 - pad;
  const pw = r.x1 - r.x0 + pad * 2;
  // 나무틀 아래 가로대가 끝나는 자리에서 시작해 책상까지 — 사이가 뜨면 안 된다
  const pt = CAGE_BOTTOM + 11;

  // 판자 밑 그림자 — 이게 있어야 떠 있는 게 아니라 얹힌 게 된다
  const sh = ctx.createLinearGradient(0, baseY, 0, baseY + 14);
  sh.addColorStop(0, 'rgba(24,14,9,0.4)');
  sh.addColorStop(1, 'rgba(24,14,9,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(px - 8, baseY, pw + 16, 14);

  ctx.fillStyle = '#7b5636';
  ctx.fillRect(px, pt, pw, baseY - pt + 1);
  ctx.fillStyle = '#b88d5a';
  ctx.fillRect(px, pt, pw, 1.5);
  ctx.fillStyle = 'rgba(43,31,22,0.5)';
  ctx.fillRect(px, baseY - 1, pw, 1.5);
  // 판자 끝면 — 나무 두께가 보여야 판자다
  ctx.fillStyle = '#5e402a';
  ctx.fillRect(px, pt + 2, 2, baseY - pt - 2);
  ctx.fillRect(px + pw - 2, pt + 2, 2, baseY - pt - 2);

  // 스탠드 불빛이 상판에도 고인다
  if (c.lampWarmth > 0.05) {
    const lit = ctx.createLinearGradient(r.x0, 0, r.x1, 0);
    lit.addColorStop(0, 'rgba(255,199,138,0)');
    lit.addColorStop(0.5, `rgba(255,199,138,${0.07 * c.lampWarmth})`);
    lit.addColorStop(1, 'rgba(255,199,138,0)');
    ctx.fillStyle = lit;
    ctx.fillRect(r.x0 - 120, baseY, r.x1 - r.x0 + 240, 26);
  }

  // 벽과 같은 어둠 — 책상만 끝까지 밝으면 바닥이 붕 뜬다
  const dark = ctx.createLinearGradient(view.left, 0, view.right, 0);
  const span = Math.max(1, view.right - view.left);
  const stop = (px: number): number => clamp((px - view.left) / span, 0, 1);
  dark.addColorStop(0, `rgba(16,12,10,${(1 - lightAt(view.left, r)) * 0.72})`);
  dark.addColorStop(stop(r.x0 - FALLOFF), 'rgba(16,12,10,0.72)');
  dark.addColorStop(stop(r.x0), 'rgba(16,12,10,0)');
  dark.addColorStop(stop(r.x1), 'rgba(16,12,10,0)');
  dark.addColorStop(stop(r.x1 + FALLOFF), 'rgba(16,12,10,0.72)');
  dark.addColorStop(1, `rgba(16,12,10,${(1 - lightAt(view.right, r)) * 0.72})`);
  ctx.fillStyle = dark;
  ctx.fillRect(view.left, baseY, span, deskH);
}

function drawProp(
  ctx: CanvasRenderingContext2D,
  x: number,
  prop: Prop,
  lit: number,
  base: number,
  c: BackdropCtx,
): void {
  if (prop === 'empty' || lit < 0.02) return;
  // 어두운 쪽일수록 흐려진다. 완전히 지우지는 않는다 — '저기 뭔가 있다'가 남아야 한다.
  ctx.globalAlpha = 0.32 + lit * 0.68;

  const cx = x + SEG_W / 2;

  switch (prop) {
    case 'window':
      drawWindow(ctx, cx, WINDOW_Y(), c);
      break;
    case 'posterSun':
      drawPoster(ctx, cx - 26, base - 12, 'sun');
      break;
    case 'posterLeaf':
      drawPoster(ctx, cx + 26, base - 12, 'leaf');
      break;
    case 'lamp':
      drawLamp(ctx, cx, base, c.lampWarmth * (lit ? 1 : 0));
      break;
    case 'books':
      drawBooks(ctx, cx, base);
      break;
    case 'plant':
      drawPlant(ctx, cx, base);
      break;
    case 'mug':
      drawMug(ctx, cx, base);
      break;
    case 'radio':
      drawRadio(ctx, cx, base);
      break;
    case 'photo':
      drawPhoto(ctx, cx - 20, base - 11);
      break;
    case 'calendar':
      drawCalendar(ctx, cx + 10, base - 15, c.time);
      break;
    case 'clock':
      drawClock(ctx, cx, base, c.time);
      break;
  }
  ctx.globalAlpha = 1;
}

// ── 소품들 ─────────────────────────────────────────────

/**
 * ★ 창밖 하늘은 시간을 따라 돈다.
 *
 * 여기가 이 게임에서 유일한 '바깥'이다. 그게 항상 같은 밝기면 밖에는 시간이
 * 흐르지 않는 셈이고, 그건 시계 생물을 기르는 게임에서 꽤 큰 손해다.
 * 새벽에 들어왔을 때 아무 글자도 안 읽고 '아, 지금 새벽이구나'가 되어야 한다.
 *
 * 색을 계산으로 뽑지 않고 여덟 시점의 색만 잡아 섞는다. 물리적으로 정확할
 * 이유가 없고, 눈에 맞는 게 맞는 거다. (finish.ts의 색온도와 같은 방식)
 *
 * night 값은 별과 달을 띄울지, 산을 얼마나 어둠에 잠글지를 함께 정한다 —
 * 하늘만 어둡고 산은 대낮이면 창문이 아니라 포스터가 된다.
 */
const SKY_STOPS: { h: number; top: string; bot: string; night: number }[] = [
  { h: 0, top: '#0e1730', bot: '#1b2444', night: 1 },
  { h: 5, top: '#222c50', bot: '#4c4665', night: 0.88 },
  { h: 6.5, top: '#5b6d9b', bot: '#dfa079', night: 0.34 }, // 일출
  { h: 8, top: '#8fb6d8', bot: '#d6e6ef', night: 0.05 },
  { h: 13, top: '#84b4dc', bot: '#cfe6f0', night: 0 },
  { h: 16.5, top: '#8ab0d4', bot: '#e2d6bd', night: 0 },
  { h: 18.5, top: '#6a76a2', bot: '#e79a63', night: 0.24 }, // 노을
  { h: 20.5, top: '#313d6b', bot: '#6f5870', night: 0.72 },
  { h: 22, top: '#111c3a', bot: '#1f2c53', night: 1 },
  { h: 24, top: '#0e1730', bot: '#1b2444', night: 1 },
];

const hex = (s: string): [number, number, number] => [
  parseInt(s.slice(1, 3), 16),
  parseInt(s.slice(3, 5), 16),
  parseInt(s.slice(5, 7), 16),
];
const mix = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const v = (p: number, q: number): number => Math.round(p + (q - p) * t);
  return `rgb(${v(ar, br)},${v(ag, bg)},${v(ab, bb)})`;
};

function skyAt(time: number): { top: string; bot: string; night: number } {
  const d = new Date(time);
  const hour = d.getHours() + d.getMinutes() / 60;
  let a = SKY_STOPS[0]!;
  let b = SKY_STOPS[SKY_STOPS.length - 1]!;
  for (let i = 0; i < SKY_STOPS.length - 1; i++) {
    if (hour >= SKY_STOPS[i]!.h && hour <= SKY_STOPS[i + 1]!.h) {
      a = SKY_STOPS[i]!;
      b = SKY_STOPS[i + 1]!;
      break;
    }
  }
  const t = b.h === a.h ? 0 : (hour - a.h) / (b.h - a.h);
  return {
    top: mix(a.top, b.top, t),
    bot: mix(a.bot, b.bot, t),
    night: a.night + (b.night - a.night) * t,
  };
}

/**
 * 달과 별.
 *
 * 밤하늘을 어둡게만 칠하면 '꺼진 창'이지 밤이 아니다. 밤이 되려면 낮에 없던
 * 것이 하나 나타나야 한다. 별은 흐리거나 눈이 오면 안 보인다 — 구름 위에
 * 별이 총총하면 날씨가 거짓말을 하는 게 된다.
 *
 * 별자리는 매번 흔들리면 안 된다. 자리를 고정해두면 '늘 같은 하늘'이 되고,
 * 그게 창밖이 진짜 어딘가라는 인상을 만든다.
 */
const STARS: [number, number, number][] = [
  [0.12, 0.1, 1],
  [0.23, 0.26, 0.7],
  [0.34, 0.08, 0.9],
  [0.46, 0.19, 0.6],
  [0.58, 0.07, 1],
  [0.66, 0.28, 0.7],
  [0.79, 0.14, 0.85],
  [0.88, 0.3, 0.6],
  [0.17, 0.4, 0.55],
  [0.72, 0.42, 0.5],
];

function drawNightSky(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  night: number,
  c: BackdropCtx,
): void {
  if (night < 0.2 || c.weather !== 'clear') return;
  const a0 = ctx.globalAlpha;
  const f = (night - 0.2) / 0.8;

  // 달 — 창 오른쪽 위. 헐레이션을 먼저 깔아야 빛나 보인다.
  const mx = x + w * 0.76;
  const my = y + h * 0.2;
  const halo = ctx.createRadialGradient(mx, my, 1, mx, my, w * 0.2);
  halo.addColorStop(0, `rgba(226,232,246,${0.3 * f})`);
  halo.addColorStop(1, 'rgba(226,232,246,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(mx - w * 0.2, my - w * 0.2, w * 0.4, w * 0.4);
  ctx.fillStyle = `rgba(238,242,252,${0.92 * f})`;
  ctx.beginPath();
  ctx.arc(mx, my, 4.2, 0, Math.PI * 2);
  ctx.fill();
  // 이지러진 자리를 하늘색으로 덮는 대신 그늘만 얹는다 — 하늘색이 그라데이션이라
  ctx.fillStyle = `rgba(120,132,168,${0.5 * f})`;
  ctx.beginPath();
  ctx.arc(mx + 1.7, my - 1, 3.6, 0, Math.PI * 2);
  ctx.fill();

  for (const [sx, sy, br] of STARS) {
    // 반짝임은 별마다 다른 속도로 — 다 같이 깜빡이면 전광판이 된다
    const tw = 0.62 + Math.sin(c.time * 0.0011 + sx * 41) * 0.38;
    ctx.globalAlpha = a0 * f * br * tw;
    ctx.fillStyle = '#eef3ff';
    ctx.fillRect(x + w * sx, y + h * sy, 1, 1);
  }
  ctx.globalAlpha = a0;
}

function drawWindow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  base: number,
  c: BackdropCtx,
): void {
  const w = WINDOW_W;
  const h = WINDOW_H;
  const x = cx - w / 2;
  const y = base - 34;
  const sky = skyAt(c.time);

  ctx.fillStyle = '#5a4438';
  ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
  ctx.fillStyle = '#6d5343';
  ctx.fillRect(x - 5, y - 5, w + 10, 2);

  /**
   * 시간대 하늘 — 위가 짙고 지평선이 밝다.
   *
   * ★ 그라데이션을 창 아래끝이 아니라 능선 높이(0.62)에서 끝낸다.
   *   창 전체에 걸치면 제일 따뜻한 색이 죄다 산 뒤에 숨어서, 노을 시간에
   *   창을 봐도 그냥 흐린 회색이었다. 지평선 색은 지평선에 있어야 한다.
   */
  const grad = ctx.createLinearGradient(0, y, 0, y + h * 0.62);
  grad.addColorStop(0, sky.top);
  grad.addColorStop(1, sky.bot);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  /**
   * 계절·날씨 색은 '한낮'에만 얹는다.
   *
   * night에 3을 곱해서 빨리 0으로 보낸다 — 해 뜨고 지는 두 시간은 하늘색을
   * 시간이 정해야지 계절이 정하면 안 된다. 노을 위에 여름 하늘색을 깔면
   * 주황이 그대로 죽는다. (들어올 때 alpha는 소품 흐림값이라 곱하기만 한다)
   */
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * 0.3 * Math.max(0, 1 - sky.night * 3);
  ctx.fillStyle = c.sky;
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = a0;

  drawNightSky(ctx, x, y, w, h, sky.night, c);

  /**
   * 창밖 — 멀리 산등성이.
   *
   * 이 게임에서 '바깥'은 여기뿐이다. 방 안이 아무리 아늑해도 바깥이 없으면
   * 아늑한 게 아니라 갇힌 거다. 멀리 있는 게 보여야 여기가 안쪽이 된다.
   * 두 겹으로 그린다 — 뒤는 흐리고 앞은 짙게. 그 대비가 거리를 만든다.
   */
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // 먼 산 — 대기에 씻겨서 하늘색에 가깝다
  ctx.fillStyle = 'rgba(126,146,166,0.5)';
  ctx.beginPath();
  ctx.moveTo(x - 4, y + h * 0.74);
  ctx.lineTo(x + w * 0.26, y + h * 0.38);
  ctx.lineTo(x + w * 0.5, y + h * 0.66);
  ctx.lineTo(x + w * 0.75, y + h * 0.44);
  ctx.lineTo(x + w + 4, y + h * 0.72);
  ctx.lineTo(x + w + 4, y + h);
  ctx.lineTo(x - 4, y + h);
  ctx.closePath();
  ctx.fill();

  // 봉우리의 눈
  ctx.fillStyle = 'rgba(244,249,252,0.8)';
  for (const [px, py] of [
    [0.26, 0.38],
    [0.75, 0.44],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x + w * px, y + h * py);
    ctx.lineTo(x + w * (px + 0.07), y + h * (py + 0.1));
    ctx.lineTo(x + w * (px + 0.03), y + h * (py + 0.08));
    ctx.lineTo(x + w * (px - 0.01), y + h * (py + 0.11));
    ctx.lineTo(x + w * (px - 0.06), y + h * (py + 0.09));
    ctx.closePath();
    ctx.fill();
  }

  // 가까운 언덕 — 짙고 초록기가 돈다
  ctx.fillStyle = 'rgba(78,100,88,0.72)';
  ctx.beginPath();
  ctx.moveTo(x - 4, y + h * 0.88);
  ctx.lineTo(x + w * 0.36, y + h * 0.62);
  ctx.lineTo(x + w * 0.6, y + h * 0.84);
  ctx.lineTo(x + w + 4, y + h * 0.68);
  ctx.lineTo(x + w + 4, y + h);
  ctx.lineTo(x - 4, y + h);
  ctx.closePath();
  ctx.fill();

  /**
   * 산도 같이 어둠에 잠긴다.
   *
   * 하늘만 밤이고 산은 대낮이면 창문이 아니라 벽에 붙인 포스터가 된다.
   * 곱하기라 능선의 명암은 살아남고 값만 내려간다 — 다시 그리는 것보다 싸고,
   * 눈 덮인 봉우리가 밤에도 제일 밝은 것까지 알아서 맞는다.
   */
  if (sky.night > 0.02) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = a0 * sky.night * 0.8;
    ctx.fillStyle = '#2c3a63';
    ctx.fillRect(x, y + h * 0.3, w, h * 0.7);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a0;
  }
  ctx.restore();

  // 창밖 날씨
  if (c.weather === 'rain' || c.weather === 'snow') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (c.weather === 'rain') {
      ctx.strokeStyle = 'rgba(226,238,248,0.45)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 20; i++) {
        const px = x + ((i * 31) % w);
        const py = y + ((c.time * 0.13 + i * 29) % (h + 12));
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - 1.4, py + 7);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 18; i++) {
        const py = y + ((c.time * 0.011 + i * 23) % (h + 8));
        const px = x + ((((i * 37) % w) + Math.sin(c.time * 0.0006 + i) * 5 + w) % w);
        ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      }
    }
    ctx.restore();
  }

  ctx.fillStyle = '#5a4438';
  ctx.fillRect(x + w / 2 - 1, y, 2, h);
  ctx.fillRect(x, y + h / 2 - 1, w, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(x, y, w, 1);

  // 창턱
  ctx.fillStyle = '#6d5343';
  ctx.fillRect(x - 8, y + h + 5, w + 16, 4);
}

/**
 * ★ 스탠드 갓 높이 — 이 숫자 하나가 방의 조명을 정한다.
 *
 * 48이었을 때는 갓이 사육장 맨 아랫줄 옆에 있었다. 그러니까 '방의 주광원'이라고
 * 써놓고 실제로는 책상 모서리만 비추고 있었던 거다. 빛이 위에서 비스듬히
 * 내려와야 사육장 왼쪽 면이 밝고 오른쪽이 어두워지고, 그래야 상자로 보인다.
 * 갓을 사육장 중간 높이까지 올린다.
 */
const LAMP_H = 78;

function drawLamp(ctx: CanvasRenderingContext2D, x: number, base: number, warmth: number): void {
  const sy = base - LAMP_H; // 갓 아랫변
  // 빛 웅덩이 — 스탠드의 진짜 역할
  if (warmth > 0.03) {
    const g = ctx.createRadialGradient(x + 8, sy - 4, 5, x + 8, sy - 4, 96);
    g.addColorStop(0, `rgba(255,214,150,${0.32 * warmth})`);
    g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 90, sy - 100, 196, 200);
  }
  // 받침 — 위가 무거우니 아래가 넓어야 서 있는 것처럼 보인다
  ctx.fillStyle = '#6e594c';
  ctx.fillRect(x - 4, base - 5, 26, 5);
  ctx.fillStyle = '#8a7060';
  ctx.fillRect(x - 4, base - 6, 26, 1.5);
  ctx.fillRect(x + 7, sy + 4, 3, LAMP_H - 9);

  ctx.fillStyle = warmth > 0.3 ? '#e8c07a' : '#9b8570';
  ctx.beginPath();
  ctx.moveTo(x - 10, sy);
  ctx.lineTo(x + 27, sy);
  ctx.lineTo(x + 19, sy - 24);
  ctx.lineTo(x - 2, sy - 24);
  ctx.closePath();
  ctx.fill();
  // 갓 윗면 하이라이트 / 안쪽 밝은 입
  ctx.fillStyle = 'rgba(184,141,90,0.55)';
  ctx.fillRect(x - 2, sy - 25, 21, 1.5);
  if (warmth > 0.3) {
    ctx.fillStyle = 'rgba(255,238,190,0.9)';
    ctx.fillRect(x - 9, sy - 1.5, 35, 2.5);
  }
}

function drawBooks(ctx: CanvasRenderingContext2D, x: number, base: number): void {
  const cols = ['#a9584f', '#5b7a8c', '#c08a4a', '#6f7d55'];
  let y = base;
  for (let i = 0; i < 4; i++) {
    const w = 26 - i * 2;
    const h = 4 + (i % 2);
    ctx.fillStyle = cols[i]!;
    ctx.fillRect(x - w / 2, y - h, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x - w / 2, y - h, w, 1);
    y -= h + 1;
  }
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, base: number): void {
  ctx.fillStyle = '#5e7a4a';
  for (const [dx, dy, rx, ry] of [
    [-6, -20, 6, 4],
    [6, -24, 6, 4],
    [0, -30, 5, 5],
    [-8, -28, 4, 3],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x + dx, base + dy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#4a6139';
  ctx.fillRect(x - 1, base - 26, 2, 14);
  ctx.fillStyle = '#a86a4e';
  ctx.beginPath();
  ctx.moveTo(x - 9, base - 14);
  ctx.lineTo(x + 9, base - 14);
  ctx.lineTo(x + 7, base);
  ctx.lineTo(x - 7, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c07f5e';
  ctx.fillRect(x - 10, base - 16, 20, 3);
}

function drawMug(ctx: CanvasRenderingContext2D, x: number, base: number): void {
  ctx.fillStyle = '#e6ddd0';
  ctx.fillRect(x - 5, base - 9, 10, 9);
  ctx.fillStyle = '#cfc3b2';
  ctx.fillRect(x - 5, base - 9, 10, 2);
  ctx.strokeStyle = '#e6ddd0';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x + 7, base - 5, 3, -1.2, 1.2);
  ctx.stroke();
}

function drawRadio(ctx: CanvasRenderingContext2D, x: number, base: number): void {
  ctx.fillStyle = '#8d6a4c';
  ctx.fillRect(x - 12, base - 14, 24, 14);
  ctx.fillStyle = '#6d4f38';
  ctx.fillRect(x - 9, base - 11, 10, 8);
  ctx.fillStyle = '#d7c39c';
  ctx.fillRect(x + 3, base - 11, 7, 3);
  ctx.fillStyle = '#c98f5a';
  ctx.beginPath();
  ctx.arc(x + 6, base - 5, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawPhoto(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#7d6047';
  ctx.fillRect(x - 14, y, 28, 22);
  ctx.fillStyle = '#e8dcc8';
  ctx.fillRect(x - 11, y + 3, 22, 16);
  // 사진 속 — 흐릿한 두 사람
  ctx.fillStyle = '#b9a184';
  ctx.fillRect(x - 11, y + 13, 22, 6);
  ctx.fillStyle = '#8f7c66';
  ctx.beginPath();
  ctx.arc(x - 4, y + 10, 3, 0, Math.PI * 2);
  ctx.arc(x + 4, y + 10, 3, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * ★ 달력.
 *
 * 26×30이었을 때는 날짜 칸이 5×4밖에 안 들어가서, 달력이라기보다 무늬였다.
 * 키우면 한 주가 7칸이라는 게 보이기 시작하고, 그 순간 벽에 걸린 게
 * '무늬'에서 '달력'이 된다. 그러면 오늘이 어디인지 표시할 수 있게 된다.
 *
 * 오늘 칸에 점 하나 찍는 것 — 이게 이 물건을 키운 진짜 이유다. 방에 시간이
 * 흐른다는 걸 말해주는 물건이 시계 하나뿐이었는데, 시계는 하루를 말하고
 * 달력은 한 달을 말한다. 며칠 만에 다시 들어왔을 때 표시가 옮겨가 있으면,
 * 그동안 이 방이 나 없이도 굴러갔다는 게 글자 없이 전해진다.
 */
const CAL_W = 46;
const CAL_H = 56;

function drawCalendar(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const left = x - CAL_W / 2;
  const d = new Date(time);

  // 벽에 드리운 그림자 — 벽에 붙은 게 아니라 걸린 물건이 된다
  ctx.fillStyle = 'rgba(35,24,16,0.2)';
  ctx.fillRect(left + 2, y + 3, CAL_W, CAL_H);

  // 걸이 — 위쪽 나무 막대와 못
  ctx.fillStyle = '#7d6047';
  ctx.fillRect(left - 2, y - 3, CAL_W + 4, 3);
  ctx.fillStyle = 'rgba(184,141,90,0.7)';
  ctx.fillRect(left - 2, y - 3, CAL_W + 4, 1);

  ctx.fillStyle = '#efe6d4';
  ctx.fillRect(left, y, CAL_W, CAL_H);
  // 종이 오른쪽이 살짝 어둡다 — 빛은 왼쪽에서 온다
  const shade = ctx.createLinearGradient(left, 0, left + CAL_W, 0);
  shade.addColorStop(0, 'rgba(74,51,34,0)');
  shade.addColorStop(1, 'rgba(74,51,34,0.16)');
  ctx.fillStyle = shade;
  ctx.fillRect(left, y, CAL_W, CAL_H);

  // 머리띠
  ctx.fillStyle = '#c1523c';
  ctx.fillRect(left, y, CAL_W, 14);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(left, y + 13, CAL_W, 1);
  ctx.fillStyle = '#f4ece0';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${d.getMonth() + 1}월`, x, y + 10.5);
  ctx.textAlign = 'left';

  /**
   * 이번 달 날짜 칸. 1일이 무슨 요일인지 맞춰야 칸이 진짜 달력처럼 앉는다 —
   * 무조건 왼쪽 위부터 채우면 매달 똑같아서 금방 무늬로 되돌아간다.
   */
  const first = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const today = first + d.getDate() - 1;

  const gx = left + 5;
  const gy = y + 19;
  const px = (CAL_W - 10) / 7;
  const py = 6.6;
  for (let i = 0; i < first + days; i++) {
    if (i < first) continue;
    const cx0 = gx + (i % 7) * px;
    const cy0 = gy + Math.floor(i / 7) * py;
    if (i === today) {
      // 오늘 — 동그라미 하나. 숫자를 쓰지 않아도 '여기'라는 건 전해진다.
      ctx.fillStyle = '#c1523c';
      ctx.beginPath();
      ctx.arc(cx0 + 1, cy0 + 1, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f6efe2';
      ctx.fillRect(cx0, cy0, 2, 2);
    } else {
      ctx.fillStyle = '#9c866f';
      ctx.fillRect(cx0, cy0, 2, 2);
    }
  }
}

/**
 * ★ 벽시계는 커야 한다.
 *
 * 반지름 12로 그렸더니 벽에 붙은 단추처럼 보였다. 시계가 작으면 장식이지만
 * 크면 '이 방의 시간'이 된다 — 시계 생물을 키우는 게임에서 그 차이는 크다.
 * 그리고 이 크기가 되면 눈금과 테두리가 보이기 시작한다. 눈금 없는 큰 원은
 * 시계가 아니라 접시다.
 */
const CLOCK_R = 24;

function drawClock(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  // 벽에 드리운 그림자 — 벽에 '붙은' 게 아니라 '걸린' 물건이 된다
  ctx.fillStyle = 'rgba(35,24,16,0.22)';
  ctx.beginPath();
  ctx.arc(x + 2, y + 3, CLOCK_R, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#7d6047';
  ctx.beginPath();
  ctx.arc(x, y, CLOCK_R, 0, Math.PI * 2);
  ctx.fill();
  // 나무 테두리 윗면만 밝게 — 빛은 위에서 온다
  ctx.strokeStyle = 'rgba(184,141,90,0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, CLOCK_R - 1, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  ctx.fillStyle = '#efe6d4';
  ctx.beginPath();
  ctx.arc(x, y, CLOCK_R - 4.5, 0, Math.PI * 2);
  ctx.fill();
  // 문자판 안쪽 그늘 — 유리 밑으로 살짝 들어가 있다
  const dish = ctx.createRadialGradient(x, y, CLOCK_R * 0.3, x, y, CLOCK_R - 4.5);
  dish.addColorStop(0, 'rgba(125,96,71,0)');
  dish.addColorStop(1, 'rgba(125,96,71,0.28)');
  ctx.fillStyle = dish;
  ctx.beginPath();
  ctx.arc(x, y, CLOCK_R - 4.5, 0, Math.PI * 2);
  ctx.fill();

  // 12개 눈금 — 3·6·9·12만 길게
  ctx.fillStyle = '#6b5540';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const len = i % 3 === 0 ? 4 : 2;
    const r0 = CLOCK_R - 7;
    ctx.fillRect(
      x + Math.cos(a) * (r0 - len) - 0.75,
      y + Math.sin(a) * (r0 - len) - 0.75,
      1.5 + len * Math.abs(Math.cos(a)) * 0.6,
      1.5 + len * Math.abs(Math.sin(a)) * 0.6,
    );
  }

  const d = new Date(time);
  const hourA = (((d.getHours() % 12) + d.getMinutes() / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  const minA = (d.getMinutes() / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.strokeStyle = '#4a3a2c';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(hourA) * (CLOCK_R * 0.44), y + Math.sin(hourA) * (CLOCK_R * 0.44));
  ctx.stroke();
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(minA) * (CLOCK_R * 0.68), y + Math.sin(minA) * (CLOCK_R * 0.68));
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#4a3a2c';
  ctx.beginPath();
  ctx.arc(x, y, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

/** 밤이면 스탠드가 켜진다 — 그녀가 오는 시간이 대개 밤이니까 */
export function lampWarmthAt(now: number): number {
  const h = new Date(now).getHours() + new Date(now).getMinutes() / 60;
  if (h >= 18 || h < 7) return 1;
  if (h >= 16) return clamp((h - 16) / 2, 0, 1);
  return 0.15;
}

/** 화면 밖에 아직 집이 더 있다는 표시 */
export function drawEdgeHint(
  ctx: CanvasRenderingContext2D,
  side: -1 | 1,
  viewW: number,
  time: number,
): void {
  const x = side < 0 ? 6 : viewW - 6;
  const pulse = 0.3 + Math.sin(time * 0.003) * 0.18;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffe6b8';
  const y = VIEW_H / 2 - 20;
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x - side * i, y + i, 2, 2);
    ctx.fillRect(x - side * i, y + 10 - i, 2, 2);
  }
  ctx.globalAlpha = 1;
}

export { originX };
