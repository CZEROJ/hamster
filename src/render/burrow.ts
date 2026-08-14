import { SUBSTRATES } from '../content/modules';
import type { Habitat } from '../sim/habitat';
import type { Hamster } from '../sim/types';
import { BURROW_MAX, BURROW_MOUTH_W, BURROW_ROOM_W, groundY, ROOM_ROWS } from '../world';

/**
 * ★ 굴 — 들어가 있을 때만 열린다.
 *
 * 처음엔 판 굴을 항상 뚫어놨다. 그랬더니 두 가지가 무너졌다:
 *
 *   1. 굴 안쪽이 사육장에서 제일 어두운 면이 됐다. 나머지가 전부 좁은
 *      따뜻한 색 대역 안에 있는데 거기 검은 구멍이 뚫린 셈이라,
 *      '판 자국'이 아니라 **그림에 뚫린 손상**으로 읽혔다.
 *   2. 햄스터가 없을 때도 계속 있었다. 하루의 대부분이 그 상태다.
 *      **빈 구멍은 증거가 아니라 흠집이다.**
 *
 * 그래서 구멍의 깊이를 '판 깊이'가 아니라 **햄스터가 들어간 깊이(dig)**에
 * 묶었다. 나오면 톱밥이 도로 덮이고 얕은 자국만 남는다. 마침 실제 햄스터도
 * 들어가면서 뒤로 입구를 막는다.
 *
 * 덤으로 색 문제도 반쯤 저절로 풀린다 — 구멍이 열려 있을 땐 그 안에
 * 햄스터가 있어서, 어두운 면적이 거의 안 남는다. 남은 반은 톤을 올려서 푼다.
 */

/** 톱밥 표면의 월드 y */
export const surfaceY = (): number => groundY(ROOM_ROWS - 1);

/**
 * 굴 경로 — 그리는 쪽과 잘라내는 쪽이 같은 도형을 봐야 한다.
 * (예전에 관에서 그림과 바닥 범위를 따로 계산했다가 반 칸이 어긋난 적이 있다)
 *
 * 입구는 좁고 아래가 넓다. 좁은 입구는 '들어간다'를, 넓은 방은 '거기서
 * 지낸다'를 말한다. 깊이는 판 깊이가 아니라 지금 들어간 깊이다.
 */
export function burrowPath(ctx: CanvasRenderingContext2D, x: number, dig: number): boolean {
  if (dig < 0.02) return false;
  const top = surfaceY();
  const d = BURROW_MAX * dig;
  const bottom = top + d;
  const mouth = BURROW_MOUTH_W / 2;
  const room = (BURROW_MOUTH_W + (BURROW_ROOM_W - BURROW_MOUTH_W) * dig) / 2;

  ctx.beginPath();
  ctx.moveTo(x - mouth, top);
  ctx.bezierCurveTo(x - room, top + d * 0.4, x - room, bottom - 3, x, bottom);
  ctx.bezierCurveTo(x + room, bottom - 3, x + room, top + d * 0.4, x + mouth, top);
  ctx.closePath();
  return true;
}

/**
 * 파낸 구멍.
 *
 * 색이 관건이다. 처음엔 거의 검정(40,26,15)으로 칠했다가 그림을 망쳤다.
 * 톱밥색을 두어 단계 어둡게 한 따뜻한 갈색이면 '그늘진 구멍'으로 읽히면서도
 * 화면의 색 대역을 벗어나지 않는다. 개미집 단면도가 딱 그렇게 그려진다.
 */
export function drawBurrowHole(
  ctx: CanvasRenderingContext2D,
  x: number,
  dig: number,
): void {
  if (!burrowPath(ctx, x, dig)) return;
  const top = surfaceY();
  const bottom = top + BURROW_MAX * dig;

  ctx.save();
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(168,128,80,0.85)');
  g.addColorStop(0.5, 'rgba(139,102,62,0.92)');
  g.addColorStop(1, 'rgba(116,83,49,0.96)');
  ctx.fillStyle = g;
  ctx.fill();
  // 안쪽 가장자리 그늘 — 이게 있어야 파인 것으로 보인다
  ctx.clip();
  ctx.strokeStyle = 'rgba(102,72,42,0.5)';
  ctx.lineWidth = 4;
  burrowPath(ctx, x, dig);
  ctx.stroke();
  ctx.restore();
}

/** 톱밥 표면 위쪽 전부. 햄스터가 보이는 영역은 이제 여기뿐이다. */
export function abovePath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.rect(-4000, -4000, 8000, 4000 + surfaceY());
}

/**
 * 남아 있는 자국 — 햄스터가 없을 때 보이는 전부.
 *
 * 아주 옅어야 한다. 여기가 눈에 걸리기 시작하면 아까 그 검은 구멍과
 * 같은 실수를 규모만 줄여서 반복하는 것이다. 파낸 톱밥이 가장자리에
 * 조금 쌓이고 가운데가 살짝 꺼진 정도 — 그게 실제로 남는 모양이기도 하다.
 */
export function drawBurrowTrace(ctx: CanvasRenderingContext2D, hab: Habitat, now: number): void {
  for (const b of hab.liveBurrows(now)) traceOne(ctx, hab, b.x, hab.burrowDepth(b, now));
}

function traceOne(
  ctx: CanvasRenderingContext2D,
  hab: Habitat,
  bx: number,
  depth: number,
): void {
  const b = { x: bx, depth };
  if (depth < 0.05) return;
  const sub = SUBSTRATES[hab.substrate];
  const y = surfaceY();
  const w = BURROW_ROOM_W * (0.5 + 0.5 * b.depth);

  // 가운데가 꺼진 자국
  const dip = ctx.createRadialGradient(b.x, y, 1, b.x, y, w * 0.6);
  dip.addColorStop(0, 'rgba(120,90,56,0.22)');
  dip.addColorStop(1, 'rgba(120,90,56,0)');
  ctx.fillStyle = dip;
  ctx.fillRect(b.x - w, y - 6, w * 2, 14);

  // 가장자리에 밀려난 톱밥
  // 봉우리와 나란히 서면 언덕 세 개가 되어 어수선하다. 아주 낮게 깐다.
  ctx.fillStyle = sub.top;
  ctx.globalAlpha = 0.55;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(b.x + s * w * 0.56, y - 0.5, w * 0.26, 1.7 + b.depth * 0.9, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = sub.speck;
  for (let i = 0; i < 12; i++) {
    const t = (i / 11 - 0.5) * 2;
    ctx.fillRect(
      Math.floor(b.x + t * w * 0.75),
      Math.floor(y - 1 - ((i * 13) % 3)),
      1,
      1,
    );
  }
}

/**
 * 굴 위로 솟은 봉우리 — 햄스터를 그린 **뒤에** 덮는다.
 *
 * 표면선에서 몸을 잘라내면 단면이 칼로 자른 듯 평평하게 남는다.
 * 그 이음매를 이 봉우리가 덮는다. 그래서 순서가 중요하다 —
 * 햄스터보다 먼저 그리면 아무것도 안 가린다.
 *
 * 숨을 따라 아주 조금 오르내린다. 이 0.6px이 이 기능의 전부다.
 * 가만히 있는 흙더미는 흙더미지만, 숨 쉬는 흙더미는 그 밑에 누가 있는 거다.
 */
export function drawBurrowMound(
  ctx: CanvasRenderingContext2D,
  hab: Habitat,
  h: Hamster,
  now: number,
): void {
  const b = hab.burrowNear(h.wx, now, 10);
  if (!b || h.dig < 0.02) return;
  const sub = SUBSTRATES[hab.substrate];
  const y = surfaceY();

  /**
   * ★ 입구를 가로막지 않는다.
   *
   * 처음엔 구멍 위로 아치를 하나 얹었다. 그런데 그러면 입구가 통째로 덮여서
   * 안이 안 보인다 — 구멍을 열어둔 이유가 사라진다. (아치가 필요했던 건
   * 표면선에서 몸이 잘린 단면을 가리기 위해서였는데, 이제 그 자리를 구멍
   * 자체가 채우니 가릴 것이 없다.)
   *
   * 파낸 톱밥은 양옆으로 밀린다. 그게 실제로 쌓이는 자리이기도 하다.
   * 숨을 따라 아주 조금 흔들린다 — 그 0.5px이 '저 밑에 살아 있다'를 말한다.
   */
  const breath = Math.sin(h.breath * (h.asleep ? 1.3 : 2.1));
  const rise = 2.2 + 4.4 * h.dig + breath * 0.5 * h.dig;
  const half = BURROW_MOUTH_W / 2 + (BURROW_ROOM_W - BURROW_MOUTH_W) * 0.25 * h.dig;

  for (const s of [-1, 1]) {
    const mx = b.x + s * (half + rise * 0.75);
    ctx.fillStyle = sub.body;
    ctx.beginPath();
    ctx.ellipse(mx, y + 1.5, rise * 1.7, rise, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = sub.top;
    ctx.beginPath();
    ctx.ellipse(mx - s * rise * 0.2, y + 1.5, rise * 1.3, rise * 0.8, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = sub.speck;
    for (let i = 0; i < 5; i++) {
      const t = (i / 4 - 0.5) * 1.7;
      ctx.fillRect(
        Math.floor(mx + t * rise * 1.5),
        Math.floor(y + 0.5 - Math.sqrt(Math.max(0, 1 - t * t)) * rise * 0.7),
        1,
        1,
      );
    }
  }
}
