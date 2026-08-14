import { SHELLS, SUBSTRATES } from '../content/modules';
import { createRng } from '../core/rng';
import type { Habitat } from '../sim/habitat';
import { boundsOf, groundY, MODULE_H, MODULE_W, originX, originY, ROOM_ROWS } from '../world';
import { drawBurrowTrace } from './burrow';

/**
 * 사육장 그리기.
 *
 * 방이 하나로 고정되면서 '칸마다 벽을 그리는' 코드를 전부 걷어냈다.
 * 이제 안쪽(상자) 한 번, 나무틀 한 번, 유리 한 번이면 끝난다.
 */

/**
 * ★ 사육장 나무 틀.
 *
 * 예전엔 칸마다 벽을 따로 그렸다. 방을 붙였다 뗐다 하던 시절엔 그래야 했지만,
 * 방이 하나로 고정된 지금은 그냥 균일한 4px 테두리만 나온다 — 액자지 사육장이 아니다.
 *
 * 실제 수조는 위아래 가로대가 두껍고 옆 기둥은 가늘다. 그리고 **아래가 제일 두껍다** —
 * 무게를 받는 자리니까. 그 두께 차이 하나가 '나무로 짠 물건'으로 읽히게 만든다.
 */
const RAIL_TOP = 7;
const RAIL_BOTTOM = 11;
const POST = 5;

export function drawCageFrame(ctx: CanvasRenderingContext2D, hab: Habitat): void {
  const b = boundsOf(hab.cells());
  const shell = SHELLS[hab.shell];
  const x = b.x - POST;
  const w = b.w + POST * 2;

  // 유리 안쪽 가장자리 그늘 — 틀보다 먼저. 유리가 틀에 끼워진 것처럼 보인다.
  const inner = ctx.createLinearGradient(0, b.y, 0, b.y + 22);
  inner.addColorStop(0, 'rgba(74,51,34,0.28)');
  inner.addColorStop(1, 'rgba(74,51,34,0)');
  ctx.fillStyle = inner;
  ctx.fillRect(b.x, b.y, b.w, 22);

  ctx.fillStyle = shell.frame;
  ctx.fillRect(x, b.y - RAIL_TOP, w, RAIL_TOP); // 위 가로대
  ctx.fillRect(x, b.y + b.h, w, RAIL_BOTTOM); // 아래 가로대 (제일 두껍다)
  ctx.fillRect(x, b.y - RAIL_TOP, POST, b.h + RAIL_TOP + RAIL_BOTTOM); // 왼 기둥
  ctx.fillRect(b.x + b.w, b.y - RAIL_TOP, POST, b.h + RAIL_TOP + RAIL_BOTTOM); // 오른 기둥

  // 나뭇결 — 가로대는 가로로, 기둥은 세로로
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = shell.frameDark;
  for (let i = 2; i < RAIL_TOP; i += 3) ctx.fillRect(x, b.y - RAIL_TOP + i, w, 1);
  for (let i = 3; i < RAIL_BOTTOM; i += 4) ctx.fillRect(x, b.y + b.h + i, w, 1);
  ctx.globalAlpha = 1;

  // 빛은 위에서 온다 — 윗면만 밝고 아랫면만 어둡다
  ctx.fillStyle = shell.frameLight;
  ctx.fillRect(x, b.y - RAIL_TOP, w, 1.5);
  ctx.fillRect(x, b.y + b.h, w, 1);
  ctx.fillStyle = shell.frameDark;
  ctx.fillRect(x, b.y + b.h + RAIL_BOTTOM - 1.5, w, 1.5);
  ctx.fillRect(x, b.y - 1, w, 1);

  // 모서리 이음 — 기둥과 가로대가 만나는 자리에 한 줄
  ctx.fillStyle = 'rgba(43,31,22,0.5)';
  ctx.fillRect(b.x - 1, b.y - RAIL_TOP, 1, b.h + RAIL_TOP + RAIL_BOTTOM);
  ctx.fillRect(b.x + b.w, b.y - RAIL_TOP, 1, b.h + RAIL_TOP + RAIL_BOTTOM);
}

/**
 * ★ 사육장 안쪽 — 상자로 보이게.
 *
 * 지금까지는 앞면 하나만 그렸다. 그래서 아무리 색을 맞춰도 유리창이지 상자가 아니었다.
 * 레퍼런스의 수조는 살짝 위에서 본 것이라 **안쪽 뒷벽과 좌우 옆면, 그리고
 * 톱밥의 윗면**이 보인다. 그 세 면이 원근으로 좁아지는 것만으로 깊이가 생긴다.
 *
 * 햄스터는 계속 맨 앞줄(바닥 앞 모서리)을 걷는다. 안쪽으로도 걸어다니게 하면
 * 시뮬레이션이 2차원에서 3차원이 되는데, 그건 이 게임에 필요 없는 복잡함이다.
 */
const DEPTH_X = 20; // 안으로 들어갈수록 좁아지는 폭
const DEPTH_Y = 12; // 안으로 들어갈수록 올라가는 높이

function drawCageInterior(ctx: CanvasRenderingContext2D, hab: Habitat): void {
  const b = boundsOf(hab.cells());
  const shell = SHELLS[hab.shell];
  const sub = SUBSTRATES[hab.substrate];
  const floorY = groundY(ROOM_ROWS - 1); // 햄스터 발이 닿는 앞쪽 바닥
  const ix = b.x + DEPTH_X;
  const iw = b.w - DEPTH_X * 2;
  const iy = b.y + DEPTH_Y;
  const iFloor = floorY - DEPTH_Y; // 뒷벽이 바닥과 만나는 높이

  const quad = (
    p: [number, number][],
    fill: string,
  ): void => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(p[0]![0], p[0]![1]);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i]![0], p[i]![1]);
    ctx.closePath();
    ctx.fill();
  };

  /**
   * ★ 먼저 안쪽을 불투명하게 덮는다.
   *
   * 천장·옆면을 반투명 그늘로만 그렸더니 사육장 뒤에 있는 창문이 뚜껑을 통해
   * 비쳐 보였다. 상자 안은 바깥이 안 보여야 상자다 — 벽을 통과해서 보이는 순간
   * 유리상자가 아니라 색유리 필터가 된다.
   */
  ctx.fillStyle = shell.wallLow;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  // 벽지 4색은 원래 '평면 배경' 시절 색이라 그대로 두면 수조가 방보다 밝다.
  // 그러면 안이 들여다보이는 상자가 아니라 벽에 박힌 전등이 된다.
  ctx.fillStyle = 'rgba(64,44,28,0.34)';
  ctx.fillRect(b.x, b.y, b.w, b.h);

  // ── 뒷벽 ──
  const g = ctx.createLinearGradient(0, iy, 0, iFloor);
  g.addColorStop(0, shell.wallTop);
  g.addColorStop(1, shell.wallLow);
  ctx.fillStyle = g;
  ctx.fillRect(ix, iy, iw, iFloor - iy);

  /**
   * ★ 뒷벽은 제일 먼 면이다 — 앞면과 같은 밝기면 상자가 아니라 전등갓이 된다.
   *
   * 벽지 색은 원래 '평면 배경' 시절에 고른 색이라 그대로 쓰면 안쪽이 바깥보다
   * 밝아서 빛이 뒤에서 나오는 것처럼 보인다. 실제로는 빛이 앞·위에서 들어오니까
   * 뒤로 갈수록 어두워야 맞다. 여기서 한 겹 죽이고, 네 모서리에 그늘을 더한다.
   * 모서리 그늘(AO)은 두 면이 만나는 자리를 알려주는 유일한 단서다.
   */
  ctx.fillStyle = 'rgba(74,51,34,0.44)';
  ctx.fillRect(ix, iy, iw, iFloor - iy);
  const ao = 26;
  const side = (x0: number, dir: 1 | -1): void => {
    const s = ctx.createLinearGradient(x0, 0, x0 + ao * dir, 0);
    s.addColorStop(0, 'rgba(58,40,25,0.42)');
    s.addColorStop(1, 'rgba(58,40,25,0)');
    ctx.fillStyle = s;
    ctx.fillRect(Math.min(x0, x0 + ao * dir), iy, ao, iFloor - iy);
  };
  side(ix, 1);
  side(ix + iw, -1);
  const roof = ctx.createLinearGradient(0, iy, 0, iy + ao);
  roof.addColorStop(0, 'rgba(58,40,25,0.4)');
  roof.addColorStop(1, 'rgba(58,40,25,0)');
  ctx.fillStyle = roof;
  ctx.fillRect(ix, iy, iw, ao);

  // ── 천장 안쪽 면 — 빛이 위에서 오니 여기가 제일 어둡다 ──
  quad(
    [
      [b.x, b.y],
      [b.x + b.w, b.y],
      [ix + iw, iy],
      [ix, iy],
    ],
    // 뚜껑 밑면은 안쪽에서 제일 어두운 면이다 — 빛을 정면으로 등지고 있다.
    // 뒷벽보다 밝으면 천장이 아니라 선반처럼 읽힌다.
    'rgba(63,43,28,0.52)',
  );

  // ── 좌우 옆면 — 램프가 왼쪽에 있어서 왼쪽이 더 밝다 ──
  quad(
    [
      [b.x, b.y],
      [ix, iy],
      [ix, iFloor],
      [b.x, floorY],
    ],
    'rgba(255,238,206,0.10)',
  );
  quad(
    [
      [b.x + b.w, b.y],
      [ix + iw, iy],
      [ix + iw, iFloor],
      [b.x + b.w, floorY],
    ],
    'rgba(74,51,34,0.32)',
  );

  // ── 톱밥 윗면 (사다리꼴) ──
  quad(
    [
      [b.x, floorY],
      [b.x + b.w, floorY],
      [ix + iw, iFloor],
      [ix, iFloor],
    ],
    sub.body,
  );
  // 뒷벽과 닿는 자리 그늘 — 이게 있어야 바닥이 벽에 붙는다
  const back = ctx.createLinearGradient(0, iFloor, 0, iFloor + 14);
  back.addColorStop(0, 'rgba(74,51,34,0.3)');
  back.addColorStop(1, 'rgba(74,51,34,0)');
  ctx.fillStyle = back;
  ctx.fillRect(ix, iFloor, iw, 14);

  /**
   * ── 톱밥 앞면 (유리에 눌린 단면) ──
   *
   * ★ 깊이를 13에서 26으로 늘리면서 여기가 화면에서 제일 큰 색면이 됐다.
   *   얇을 땐 '가장자리'라 단색이어도 괜찮았는데, 두꺼워지니 눌린 톱밥이
   *   아니라 크림색 블록으로 보였다.
   *
   *   실제 사육장 옆면이 그렇듯 **아래로 갈수록 눌려서 어둡고 촘촘하다.**
   *   위는 방금 갈아준 것처럼 푸슬푸슬하고 아래는 다져져 있다. 그 차이만
   *   넣어도 같은 면적이 '두께'로 읽힌다.
   *
   *   그리고 이 단면은 앞으로 굴이 지나갈 자리다 — 깊게 판 진짜 값이 여기 있다.
   */
  const face = ctx.createLinearGradient(0, floorY, 0, b.y + b.h);
  face.addColorStop(0, sub.body);
  face.addColorStop(0.45, sub.dark);
  face.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sub.dark;
  ctx.fillRect(b.x, floorY, b.w, b.y + b.h - floorY);
  ctx.fillStyle = face;
  ctx.fillRect(b.x, floorY, b.w, b.y + b.h - floorY);
  // 바닥에 가라앉은 그늘 — 유리 밑동이 어두워야 상자가 땅에 붙는다
  const sink = ctx.createLinearGradient(0, b.y + b.h - 12, 0, b.y + b.h);
  sink.addColorStop(0, 'rgba(74,51,34,0)');
  sink.addColorStop(1, 'rgba(74,51,34,0.38)');
  ctx.fillStyle = sink;
  ctx.fillRect(b.x, b.y + b.h - 12, b.w, 12);

  // 단면에 박힌 알갱이 — 아래로 갈수록 잘게 다져진 느낌
  ctx.fillStyle = sub.speck;
  ctx.globalAlpha = 0.5;
  for (const s of faceSpecks(b.w, floorY, b.y + b.h)) {
    ctx.fillRect(Math.floor(b.x + s.x), Math.floor(s.y), s.w, 1);
  }
  ctx.globalAlpha = 1;

  // 윗면과 만나는 자리 — 푸슬푸슬한 결
  ctx.fillStyle = sub.top;
  for (let x = 0; x < b.w; x += 3) {
    const bump = ((x * 37) % 7) / 3 - 1;
    ctx.fillRect(b.x + x, floorY - 1 + bump, 3, 4 - bump);
  }

  // 알갱이 — 윗면에만 뿌린다
  ctx.fillStyle = sub.speck;
  for (const s of speckField(b.w, iFloor, floorY)) {
    ctx.fillRect(Math.floor(b.x + s.x), Math.floor(s.y), s.w, 1);
  }
}

/** 단면에 박힌 알갱이. 위쪽이 성글고 아래로 갈수록 촘촘하다 — 다져지니까. */
let faceCache: { x: number; y: number; w: number }[] | null = null;
function faceSpecks(w: number, top: number, bottom: number): { x: number; y: number; w: number }[] {
  if (faceCache) return faceCache;
  const rng = createRng(0x1f3d5b71);
  const out: { x: number; y: number; w: number }[] = [];
  for (let i = 0; i < 150; i++) {
    const t = rng.range(0, 1) ** 0.7; // 아래쪽으로 치우친다
    out.push({
      x: rng.range(3, w - 3),
      y: top + 3 + (bottom - top - 5) * t,
      w: rng.chance(0.8) ? 1 : 2,
    });
  }
  faceCache = out;
  return out;
}

/** 톱밥 알갱이 자리. 한 번 정하면 안 바뀐다 — 매 프레임 바뀌면 지글거린다. */
let speckCacheV2: { x: number; y: number; w: number }[] | null = null;
function speckField(w: number, top: number, bottom: number): { x: number; y: number; w: number }[] {
  if (speckCacheV2) return speckCacheV2;
  const rng = createRng(0x5bf03635);
  const out: { x: number; y: number; w: number }[] = [];
  for (let i = 0; i < 190; i++) {
    // 안쪽(위)일수록 촘촘하게 — 멀어지는 느낌이 난다
    const t = Math.sqrt(rng.range(0, 1));
    out.push({
      x: rng.range(6, w - 6),
      y: top + 2 + (bottom - top - 3) * t,
      w: rng.chance(0.72) ? 1 : 2,
    });
  }
  speckCacheV2 = out;
  return out;
}

/**
 * ★ 수조 안쪽 조명등.
 *
 * 사육장 윗변에 달린 등 하나. 이게 있고 없고가 분위기의 큰 몫이다.
 *
 * 방 전체가 고르게 밝으면 아늑한 게 아니라 그냥 밝은 거다. 안쪽에 광원이
 * 하나 있으면 사육장이 '방 안의 방'이 되고, 유리 안쪽이 바깥보다 밝아지면서
 * 들여다보는 물건이 된다. 햄스터가 거기 있어야 할 이유가 그림으로 생긴다.
 */
function drawTankLight(ctx: CanvasRenderingContext2D, hab: Habitat): void {
  const b = boundsOf(hab.cells());
  const x0 = b.x + 8;
  const x1 = b.x + b.w - 8;
  const y = b.y + 3;

  // 등에서 아래로 쏟아지는 빛 — 바닥에 닿기 전에 잦아든다
  const g = ctx.createLinearGradient(0, y, 0, b.y + b.h * 0.82);
  g.addColorStop(0, 'rgba(255,236,192,0.2)');
  g.addColorStop(0.35, 'rgba(255,230,182,0.07)');
  g.addColorStop(1, 'rgba(255,232,186,0)');
  ctx.fillStyle = g;
  ctx.fillRect(b.x, y, b.w, b.h * 0.82 - 3);

  // 등 자체 — 가늘고 밝은 띠
  ctx.fillStyle = 'rgba(120,96,72,0.55)';
  ctx.fillRect(x0, y, x1 - x0, 3.5);
  ctx.fillStyle = 'rgba(255,246,214,0.92)';
  ctx.fillRect(x0 + 2, y + 0.8, x1 - x0 - 4, 1.8);
  // 등 바로 아래가 제일 밝다
  const hot = ctx.createLinearGradient(0, y + 2, 0, y + 14);
  hot.addColorStop(0, 'rgba(255,244,208,0.4)');
  hot.addColorStop(1, 'rgba(255,244,208,0)');
  ctx.fillStyle = hot;
  ctx.fillRect(x0, y + 2, x1 - x0, 12);
}

export function drawHabitatBack(ctx: CanvasRenderingContext2D, hab: Habitat, now: number): void {
  drawCageInterior(ctx, hab);
  // 표면에 남은 자국. 봉우리는 햄스터를 덮어야 해서 여기가 아니라 뒤에 그린다.
  drawBurrowTrace(ctx, hab, now);
  drawTankLight(ctx, hab);
}

/**
 * 유리 반사는 사육장 전체에 한 번만 긋는다.
 * 칸마다 그으면 52픽셀마다 줄이 생겨서 유리가 아니라 격자로 보인다.
 * 한 번에 비스듬히 긋고 방 모양으로 잘라내면, 조각조각 붙인 집이
 * 유리 하나로 덮인 것처럼 보인다 — 그게 '한 집'이라는 인상을 만든다.
 */
function drawGlassSheen(ctx: CanvasRenderingContext2D, hab: Habitat): void {
  if (hab.modules.length === 0) return;
  const b = boundsOf(hab.cells());

  ctx.save();
  ctx.beginPath();
  for (const m of hab.modules) {
    ctx.rect(originX(m.cx), originY(m.cy), MODULE_W, MODULE_H);
  }
  ctx.clip();

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  const slant = b.h * 0.55;
  for (const [at, w] of [
    [0.18, 26],
    [0.3, 11],
  ] as const) {
    const x = b.x + b.w * at;
    ctx.beginPath();
    ctx.moveTo(x, b.y + b.h);
    ctx.lineTo(x + slant, b.y);
    ctx.lineTo(x + slant + w, b.y);
    ctx.lineTo(x + w, b.y + b.h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawHabitatFront(ctx: CanvasRenderingContext2D, hab: Habitat): void {
  drawGlassSheen(ctx, hab);
  drawCageFrame(ctx, hab);
}
