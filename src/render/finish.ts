import { createRng } from '../core/rng';

/**
 * 마감 두 겹 — 결(grain)과 비네트.
 *
 * ★ 지금 화면이 '납작한 벡터'로 읽히는 제일 큰 이유는 면이 너무 매끈해서다.
 *   색을 아무리 맞춰도 완벽하게 균일한 색면은 그림이 아니라 도형으로 보인다.
 *   아주 옅은 결을 한 겹 덮으면 같은 색인데 인쇄물처럼 읽힌다.
 *
 *   비네트는 그 다음이다. 가장자리를 살짝 죽이면 시선이 가운데로 모이고,
 *   '방 안에서 한 곳을 보고 있다'는 느낌이 생긴다. 아늑함의 절반은 시야가
 *   좁다는 감각이다.
 *
 * 둘 다 화면 좌표에서 그린다 — 카메라를 따라 흔들리면 즉시 지저분해진다.
 */

let tile: CanvasPattern | null = null;

/** 결 무늬는 한 번만 만든다. 매 프레임 만들면 프레임마다 지글거린다. */
function grainTile(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (tile) return tile;
  const size = 96;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d');
  if (!g) return null;

  const img = g.createImageData(size, size);
  const rng = createRng(0x9e3779b9);
  for (let i = 0; i < size * size; i++) {
    // 가운데(128) 주변으로만 흔들린다 — overlay에서 밝기를 위아래로만 민다
    // 128 정확히 가운데로 흔든다 — 한쪽으로 치우치면 색이 회색으로 빠진다
    const v = 118 + rng.range(0, 20);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  tile = ctx.createPattern(cv, 'repeat');
  return tile;
}

export function drawGrain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const p = grainTile(ctx);
  if (!p) return;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = p;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * ★ 시간대별 색온도.
 *
 * 아침은 푸르고 심야는 짙은 호박색이다. 실제 방이 그렇다 — 같은 방인데
 * 아침에 보는 것과 새벽에 보는 것이 다른 색이고, 그 차이가 '지금 몇 시인지'를
 * 시계 없이 알려준다. 이 게임은 시계 생물을 키우는 게임이라 이게 특히 값싸게 먹힌다.
 *
 * 켈빈값을 그대로 계산하지 않고 다섯 시점의 색만 잡아 섞는다.
 * 물리적으로 정확할 이유가 없고, 눈에 맞는 게 맞는 거다.
 */
const TEMP_STOPS: { h: number; c: [number, number, number]; a: number }[] = [
  { h: 0, c: [255, 168, 100], a: 0.3 }, // 심야 2300K
  { h: 6, c: [255, 176, 110], a: 0.26 },
  { h: 8, c: [206, 220, 240], a: 0.16 }, // 아침 6000K — 여기만 푸르다
  { h: 12, c: [236, 230, 216], a: 0.08 }, // 낮 5000K
  { h: 17, c: [248, 220, 182], a: 0.16 }, // 저녁 4200K
  { h: 21, c: [255, 196, 138], a: 0.26 }, // 밤 3000K
  { h: 24, c: [255, 168, 100], a: 0.3 },
];

export function drawTemperature(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  now: number,
): void {
  const d = new Date(now);
  const hour = d.getHours() + d.getMinutes() / 60;

  let a = TEMP_STOPS[0]!;
  let b = TEMP_STOPS[TEMP_STOPS.length - 1]!;
  for (let i = 0; i < TEMP_STOPS.length - 1; i++) {
    if (hour >= TEMP_STOPS[i]!.h && hour <= TEMP_STOPS[i + 1]!.h) {
      a = TEMP_STOPS[i]!;
      b = TEMP_STOPS[i + 1]!;
      break;
    }
  }
  const t = b.h === a.h ? 0 : (hour - a.h) / (b.h - a.h);
  const mix = (i: number): number => Math.round(a.c[i]! + (b.c[i]! - a.c[i]!) * t);

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = a.a + (b.a - a.a) * t;
  ctx.fillStyle = `rgb(${mix(0)},${mix(1)},${mix(2)})`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/**
 * 공기 중의 먼지.
 *
 * 빛이 보이려면 빛을 받을 게 공중에 떠 있어야 한다. 아무것도 없는 공기는
 * 그냥 투명해서, 조명을 아무리 넣어도 '밝다'로만 보이고 '빛이 든다'로는 안 보인다.
 * 아주 작은 알갱이 몇 개면 충분하다 — 많으면 눈이라서 즉시 날씨가 된다.
 */
export function drawDust(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgb(255,234,195)';
  for (let i = 0; i < 22; i++) {
    const seed = ((i * 2654435761) >>> 0) / 4294967295;
    const drift = 0.004 + (i % 5) * 0.0012;
    // 가로는 아주 느리게 흔들리고, 세로로 천천히 내려앉는다
    const x = (seed * w + Math.sin(t * 0.00025 + i * 1.7) * 16 + w) % w;
    const y = (seed * h * 2.3 + t * drift) % (h + 30);
    ctx.globalAlpha = 0.05 + (i % 4) * 0.018;
    ctx.beginPath();
    ctx.arc(x, y, i % 3 === 0 ? 1.3 : 0.85, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // 가운데를 사육장 높이에 맞춰 살짝 위로 — 아래는 책상이라 어두워도 괜찮다
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const g = ctx.createRadialGradient(
    w / 2,
    h * 0.52,
    Math.min(w, h) * 0.3,
    w / 2,
    h * 0.52,
    Math.max(w, h) * 0.72,
  );
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.62, 'rgba(226,216,206,1)');
  g.addColorStop(1, 'rgba(198,184,172,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
