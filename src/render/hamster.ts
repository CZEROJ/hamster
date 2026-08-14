import { COATS, type Coat } from '../content/breeds';
import { clamp, lerp } from '../core/math';
import type { Hamster } from '../sim/types';

import { P } from './palette';

/**
 * 절차적 햄스터.
 *
 * 스프라이트 대신 코드로 그리는 이유:
 *  1. 고개 방향을 8방향이 아니라 '연속 각도'로 돌릴 수 있다 → 시선 추적이 부드럽다
 *  2. 호흡·스쿼시·기지개를 파라미터로 다룰 수 있다 → 타이밍을 튜닝할 수 있다
 *  3. 아트 의존성 없이 지금 가설을 검증할 수 있다
 *
 * 머리는 '구'로 모델링한다. yaw = 0이면 정면(플레이어를 봄), ±PI/2면 완전 측면.
 * 각 부위는 얼굴 정면 기준 방위각(azimuth)을 가지고, sin으로 x, cos으로 깊이를 얻는다.
 * 측면일 때 눈이 정확히 하나만 보이는 것도 이 모델에서 공짜로 나온다.
 */

const HEAD_R = 7.4;
const AZ_EYE = 0.95;
const AZ_EAR = 1.95;

/**
 * ★ 얼굴 부위의 '고도'(elevation) — 방위각(azimuth)의 세로 짝.
 *
 * 머리를 구로 잡아놨으면서 지금까지 세로는 안 쓰고 있었다. 그래서 고개를
 * 들어도 얼굴은 그대로고 머리 전체만 위로 밀렸다 — 그건 고개를 든 게 아니라
 * 머리가 뜬 거다.
 *
 * 부위마다 얼굴 정면 기준 고도를 주고, headPitch만큼 통째로 돌린다.
 * 위를 보면 눈이 이마 쪽으로 올라오고 주둥이가 따라 올라오면서 턱이 들린다.
 * 가로 폭이 cos(고도)만큼 줄어드는 단축법까지 공짜로 따라온다 —
 * 방위각이 이미 그렇게 동작하고 있으니 같은 모델의 나머지 절반일 뿐이다.
 */
const EL_EYE = 0.08;
const EL_MUZZLE = -0.35;
const EL_CHEEK = -0.43;
const EL_BLUSH = -0.27;

/** 발끝을 기준으로 한 전체 배율. 주인공은 화면에서 충분히 커야 한다. */
const SCALE = 1.28;

function ell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.4, rx), Math.max(0.4, ry), 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawHamster(ctx: CanvasRenderingContext2D, h: Hamster): void {
  ctx.save();
  /**
   * ★ 확대는 반드시 '발끝'을 기준으로 걸어야 한다.
   *   기준점을 옮기면 배율(1.28)이 다른 점을 중심으로 먹어서 몸 전체가 밀린다.
   *   회전만 몸통 중앙을 축으로 따로 건다 — 발끝을 축으로 돌리면
   *   몸이 휘둘리는 게 아니라 바닥에서 미끄러지는 걸로 보인다.
   */
  ctx.translate(h.wx, h.wy);
  ctx.scale(SCALE, SCALE);
  if (h.flail > 0.01) {
    ctx.translate(0, -10);
    ctx.rotate(Math.sin(h.breath * 21) * 0.3 * h.flail);
    ctx.translate(0, 10);
  }
  ctx.translate(-h.wx, -h.wy);
  drawBody(ctx, h);
  ctx.restore();
}

function drawBody(ctx: CanvasRenderingContext2D, h: Hamster): void {
  // 털색은 개체마다 다르다 — 내 햄스터만 골든이고 나머지는 손님이다
  const coat = COATS[h.breed];
  const yaw = h.headYaw;
  const front = Math.cos(yaw); // 1 = 정면
  const s = clamp(h.stand, 0, 1.12);
  const c = h.curl;
  /**
   * ★ 납작 — 세 번째 자세 축.
   *
   * 렌더러는 action 이름을 모른다. 숫자 하나만 읽는다. 그래서 나중에
   * '배 까고 눕기'가 들어와도 여기 분기가 늘지 않고, 자세끼리 섞이는 것도
   * 시뮬이 damp 하나로 처리한다.
   */
  const fl = clamp(h.flat, 0, 1);
  const ground = h.wy;

  // 늘어져 있으면 옆구리가 눈에 띄게 오르내린다 — 몸이 넓적해진 만큼 잘 보인다
  const breathAmp = h.asleep ? 0.055 : lerp(0.032, 0.052, fl);
  const breathe = 1 + Math.sin(h.breath * (h.asleep ? 1.3 : 2.1)) * breathAmp;

  const ls = h.landSquash;
  const sqX = 1 + 0.16 * ls;
  const sqY = 1 - 0.2 * ls;

  const stretch = h.action === 'stretch' ? Math.sin((h.actionT / h.actionDur) * Math.PI) : 0;

  const x = Math.round(h.wx * 2) / 2;
  const lean = h.flinch * -h.facing * 2;

  // ── 몸통 ────────────────────────────────────────
  let bodyCY = ground - lerp(8.6, 13.2, s);
  bodyCY = lerp(bodyCY, ground - 7.8, c);
  let bodyRx = (11.6 - 2.4 * front) * lerp(1, 0.84, s) * lerp(1, 1.0, c) * sqX;
  let bodyRy = 8.3 * lerp(1, 1.32, s) * lerp(1, 1.06, c) * breathe * sqY;
  bodyRx *= 1 + stretch * 0.16;
  bodyRy *= 1 - stretch * 0.1;

  /**
   * 납작해진다 — 세로로 눌리고 가로로 퍼지고 바닥에 붙는다.
   * 부피는 어디 안 가니까 세로로 줄인 만큼 가로로 늘려야 한다.
   * 안 그러면 '늘어진' 게 아니라 '작아진' 걸로 보인다.
   */
  bodyCY = lerp(bodyCY, ground - 4.9, fl);
  bodyRx *= lerp(1, 1.34, fl);
  bodyRy *= lerp(1, 0.58, fl);

  /**
   * ★ 달리는 중 — 몸이 낮아지고 위아래로 들썩인다.
   *
   * 러닝휠이 도는데 햄스터가 가만히 서 있으면 바퀴가 저절로 도는 걸로 보인다.
   * 다리가 움직여야 얘가 돌리는 게 된다.
   *
   * 들썩임은 다리보다 **두 배 빠르다.** 발이 한 번 땅을 찰 때마다 몸이 한 번
   * 뜨니까 — 이 2배가 없으면 달리는 게 아니라 흔들리는 걸로 보인다.
   */
  const rn = clamp(h.run, 0, 1);
  const step = h.runPhase;
  bodyCY += (Math.sin(step * 2) * 1.3 - 1.6) * rn;
  bodyRx *= lerp(1, 1.06, rn);
  bodyRy *= lerp(1, 0.94, rn);

  // ── 머리 ────────────────────────────────────────
  // 턱을 바닥에 붙이고 앞으로 더 뺀다. 머리만 안 내려가면 몸만 눌린 꼴이 된다.
  const headFwd = Math.sin(yaw) * 8 * lerp(1, 0.35, c) * lerp(1, 1.55, fl);
  let headX = x + headFwd + lean;
  let headY = ground - lerp(15.0, 24.0, s);
  headY = lerp(headY, ground - 9.6, c);
  // 머리 반지름이 7.4라 여기보다 더 내리면 머리가 바닥선을 뚫는다.
  // 살짝 파묻힌 정도가 딱 좋다 — 톱밥에 얼굴을 묻은 것처럼 보인다.
  headY = lerp(headY, ground - 6.4, fl);
  // 달릴 땐 고개를 앞으로 내밀고 몸과 같은 박자로 들썩인다
  headY += (Math.sin(step * 2) * 1.1 - 1.4) * rn;
  headX += Math.sin(yaw) * 2.4 * rn;
  headY += h.headPitch * 3.6;
  headY -= (breathe - 1) * 8;

  /**
   * 부위를 머리 구 위에 앉히는 자 하나.
   * base = 그 부위의 고도, pitch를 빼면 고개를 든 만큼 위로 돈다.
   * 돌아간 각도만큼 가로가 좁아진다(단축법).
   */
  const pitch = h.headPitch;
  const faceY = (base: number): number => headY - HEAD_R * Math.sin(base - pitch);
  const faceK = (base: number): number => Math.cos(base - pitch);

  // 세수: 머리가 살짝 흔들린다
  if (h.action === 'groom') {
    headY += Math.sin(h.groomPhase) * 0.7;
    headX += Math.cos(h.groomPhase * 0.5) * 0.4;
  }

  // ── 그림자 ──────────────────────────────────────
  ell(ctx, x + 1, ground + 1.5, bodyRx * 0.95, 2.6 * lerp(1, 0.7, s), P.shadow);

  // ── 꼬리 ────────────────────────────────────────
  const tailX = x - Math.sin(yaw) * bodyRx * 0.85;
  ell(ctx, tailX, bodyCY + bodyRy * 0.45, 1.6, 1.4, coat.shade);

  // ── 뒷발 ────────────────────────────────────────
  if (fl > 0.2) {
    /**
     * ★ 늘어졌을 때의 뒷다리 — 뒤로 쭉 뻗는다.
     *
     * 처음엔 옆으로만 벌렸는데 하나도 안 보였다. 몸이 넓적해지면서 발이
     * 실루엣 **안쪽**에 들어가 버렸기 때문이다. 배가 바닥에 닿아 있어서
     * 아래로도 빠져나올 데가 없다. 남는 방향은 뒤뿐이다.
     *
     * 그리고 그게 실제 자세이기도 하다 — 늘어진 햄스터는 뒷다리를 몸 뒤로
     * 쭉 뻗는다. 몸통 밖으로 삐져나온 이 두 짝이 '늘어짐'의 서명이다.
     */
    const dir = Math.sin(yaw) >= 0 ? 1 : -1;
    const back = x - Math.sin(yaw) * bodyRx * 0.94;
    ell(ctx, back - dir * 1.6, ground - 1.3, 3.2 * fl, 1.5 * fl + 0.2, coat.shade);
    ell(ctx, back + dir * 0.8, ground - 2.6, 2.8 * fl, 1.4 * fl + 0.2, coat.base);
  } else if (rn > 0.15) {
    /**
     * ★ 달리는 뒷다리 — 두 짝이 반 박자씩 어긋나 돈다.
     *
     * 앞뒤로만 움직이면 미끄러지는 걸로 보인다. 원을 그리게 해야 딛고
     * 차는 게 된다 — 앞으로 갈 땐 들리고, 뒤로 갈 땐 바닥에 붙는다.
     * 뒤로 가는 쪽이 바닥을 미는 발이고, 그게 바퀴를 돌리는 발이다.
     */
    const dir = Math.sin(yaw) >= 0 ? 1 : -1;
    for (const [k, phase] of [
      [0, 0],
      [1, Math.PI],
    ] as const) {
      const a = step + phase;
      const fx = x + dir * Math.cos(a) * 5.2 * rn;
      const lift = Math.max(0, Math.sin(a)) * 3.4 * rn;
      ell(ctx, fx, ground - 1.8 - lift, 2.2, 1.6, k === 0 ? coat.shade : coat.base);
    }
  } else if (c < 0.6) {
    // 측면일수록 두 발이 겹치고(단축법), 정면일수록 벌어진다
    const spread = 4.9 * (0.3 + front * 0.8);
    ell(ctx, x - spread, ground - 2.0, 2.1, 1.6, coat.shade);
    ell(ctx, x + spread, ground - 2.0, 2.1, 1.6, coat.base);
  }

  // ── 귀 (머리 뒤쪽에 오는 것) ──────────────────────
  const ears = [-1, 1].map((sign) => {
    const az = sign * (AZ_EAR + h.earTwitch * 0.12 * sign);
    const a = yaw + az;
    const ex = headX + Math.sin(a) * HEAD_R * 0.92;
    // 고개를 들면 귀는 뒤로 눕는다 — 구 위에서 그대로 돌리면 머리 밖으로
    // 날아가니까, 세로로만 살짝 민다
    const ey =
      headY -
      HEAD_R * (0.62 + h.earPerk * 0.28) +
      Math.abs(h.earTwitch) * 0.4 -
      pitch * 2.0;
    const r = 3.3 * lerp(0.72, 1, h.earPerk);
    return { ex, ey, r, d: Math.cos(a) };
  });
  for (const e of ears) if (e.d < 0) drawEar(ctx, e.ex, e.ey, e.r, coat);

  // ── 몸통 본체 ───────────────────────────────────
  ell(ctx, x + lean * 0.4, bodyCY, bodyRx, bodyRy, coat.base);
  // 등 하이라이트
  ell(ctx, x + lean * 0.4, bodyCY - bodyRy * 0.35, bodyRx * 0.72, bodyRy * 0.5, coat.light);
  // 배
  ell(
    ctx,
    x + lean * 0.4 + Math.sin(yaw) * 1.5,
    bodyCY + bodyRy * 0.42,
    bodyRx * 0.6,
    bodyRy * 0.44,
    coat.belly,
  );

  // ── 머리 본체 ───────────────────────────────────
  ell(ctx, headX, headY, HEAD_R, HEAD_R * 0.94, coat.base);
  ell(ctx, headX, headY - HEAD_R * 0.3, HEAD_R * 0.8, HEAD_R * 0.55, coat.light);

  // ── 볼주머니 ────────────────────────────────────
  // 먹이를 물면 부푼다. 이 게임에서 제일 귀여운 실루엣이고, 만드는 데 6줄이면 된다.
  if (h.cheek > 0.03) {
    for (const sign of [-1, 1]) {
      const a = yaw + sign * (AZ_EYE + 0.55);
      if (Math.cos(a) <= -0.2) continue;
      const cxp = headX + Math.sin(a) * HEAD_R * 0.95 * faceK(EL_CHEEK);
      ell(ctx, cxp, faceY(EL_CHEEK), 3.0 * h.cheek + 1.2, 2.6 * h.cheek + 1, coat.base);
    }
  }

  // ── 앞의 귀 ─────────────────────────────────────
  for (const e of ears) if (e.d >= 0) drawEar(ctx, e.ex, e.ey, e.r, coat);

  // ── 주둥이 / 코 ─────────────────────────────────
  const wig = Math.sin(h.breath * 24) * 0.7 * h.noseWiggle;
  const muzA = yaw;
  const muzX = headX + Math.sin(muzA) * HEAD_R * 0.68 * faceK(EL_MUZZLE) + wig * Math.cos(muzA);
  const muzY = faceY(EL_MUZZLE);
  if (Math.cos(muzA) > -0.35) {
    // 고개를 들면 주둥이가 정면을 향해 돌아서 세로로 짧아 보인다
    ell(ctx, muzX, muzY, 3.2, 2.4 * lerp(1, 0.78, clamp(-pitch, 0, 1)), coat.belly);
    ell(ctx, muzX + Math.sin(muzA) * 1.2, muzY - 0.6, 1.0, 0.8, P.nose);

    // 수염은 안 그린다. 이 크기에서는 뭘 해도 얼굴에 낀 얼룩으로 읽힌다.
  }

  // ── 눈 ──────────────────────────────────────────
  for (const sign of [-1, 1]) {
    const a = yaw + sign * AZ_EYE;
    const d = Math.cos(a);
    if (d <= 0.04) continue;
    const ex = headX + Math.sin(a) * HEAD_R * 0.82 * faceK(EL_EYE);
    const ey = faceY(EL_EYE);
    const open = clamp(h.eyeOpen, 0, 1);
    if (open < 0.08) {
      // 감은 눈 — 짧은 선
      ctx.fillStyle = P.eye;
      ctx.fillRect(ex - 1.4, ey, 2.8, 0.8);
    } else {
      ell(ctx, ex, ey, 1.85 * (0.6 + d * 0.4), 1.95 * open, P.eye);
      ell(ctx, ex - 0.55, ey - 0.7 * open, 0.55, 0.5 * open, P.eyeGlint);
    }
  }

  // ── 볼터치 ──────────────────────────────────────
  const blush = clamp((h.comfort - 0.55) / 0.45, 0, 1) * (h.petting ? 1 : 0.65);
  if (blush > 0.05) {
    ctx.globalAlpha = blush;
    for (const sign of [-1, 1]) {
      const a = yaw + sign * (AZ_EYE + 0.42);
      if (Math.cos(a) <= 0.06) continue;
      ell(ctx, headX + Math.sin(a) * HEAD_R * 0.88 * faceK(EL_BLUSH), faceY(EL_BLUSH), 1.8, 1.1, P.blush);
    }
    ctx.globalAlpha = 1;
  }

  // ── 앞발 ────────────────────────────────────────
  if (h.action === 'groom') {
    // 세수 — 이 게임의 대표 애니메이션
    const g = h.groomPhase;
    for (const sign of [-1, 1]) {
      const px = headX + sign * 2.6 + Math.sin(g) * 0.8;
      const py = headY + HEAD_R * 0.5 + Math.cos(g) * 1.6;
      ell(ctx, px, py, 1.7, 1.5, coat.light);
    }
  } else if (rn > 0.15) {
    // 앞발도 같이 젓는다. 뒷다리와 반대 위상이라야 네 발이 엇갈려 돈다.
    const dir = Math.sin(yaw) >= 0 ? 1 : -1;
    for (const [k, phase] of [
      [0, Math.PI * 0.5],
      [1, Math.PI * 1.5],
    ] as const) {
      const a = step + phase;
      const px = headX - Math.sin(yaw) * 2 + dir * Math.cos(a) * 3.4 * rn;
      const py = bodyCY + bodyRy * 0.55 - Math.max(0, Math.sin(a)) * 2.6 * rn;
      ell(ctx, px, py, 1.7, 1.5, k === 0 ? coat.shade : coat.light);
    }
  } else if (fl > 0.2) {
    /**
     * 늘어졌을 때의 앞발 — 턱 **앞쪽** 바닥에 널브러진다.
     *
     * 머리 옆에 두었더니 주둥이와 코를 덮어서 얼굴을 가리고 세수하는
     * 것처럼 보였다. 앞으로 빼야 '뻗은 팔'이 되고 얼굴도 살아난다.
     * 한 짝은 살짝 뒤로 어긋나게 — 두 짝이 겹치면 발이 하나로 보인다.
     */
    for (const sign of [-1, 1]) {
      const px = headX + Math.sin(yaw) * 5.6 + sign * 2.2 * front;
      const py = ground - 1.4 - sign * 0.8;
      ell(ctx, px, py, 2.0 * fl + 0.4, 1.2 * fl + 0.3, sign < 0 ? coat.shade : coat.light);
    }
  } else if (s > 0.25 || c > 0.4) {
    const py = c > 0.4 ? bodyCY + bodyRy * 0.3 : bodyCY - bodyRy * 0.15;
    for (const sign of [-1, 1]) {
      ell(ctx, x + sign * 2.4 + Math.sin(yaw) * 1.5, py, 1.6, 1.4, coat.light);
    }
  }
}

function drawEar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  coat: Coat,
): void {
  ell(ctx, x, y, r, r * 1.05, coat.shade);
  ell(ctx, x, y + r * 0.1, r * 0.55, r * 0.6, coat.ear);
}
