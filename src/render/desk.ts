import { BREED_IDS, COATS, type BreedId } from '../content/breeds';
import { FOOD_IDS, FOODS, type FoodId } from '../content/foods';
import { FURNITURE_IDS } from '../content/furniture';
import { FURNITURE, type FurnitureId } from '../content/furniture';
import { SUBSTRATE_IDS, SUBSTRATES } from '../content/modules';
import { drawShelfIcon } from './furniture';
import { COARSE, VIEW_H, VIEW_W } from './screen';

/**
 * 책상 위의 물건들 — 공책, 먹이 항아리, 보관함.
 *
 * 메뉴 버튼을 하나도 안 만든 이유:
 * System 1에서 HUD를 0으로 만든 게 몰입의 대부분이었다. 여기서 그걸 깨면 손해가 크다.
 * 물건을 집어 든다는 행위 자체가 의식이 되고, 화면은 계속 '방'으로 남는다.
 */
export const LEDGE_Y = () => VIEW_H - 30;

/**
 * ★ 내 물건은 오른쪽에 모아 둔다.
 *
 * 예전엔 공책이 왼쪽 끝, 항아리가 한가운데, 상자가 오른쪽 끝이었다.
 * 화면이 넓어질수록 셋이 서로 멀어져서, 뭘 하려면 눈이 화면을 가로질러야 했다.
 * 한 손 닿는 자리에 모여 있어야 '내 물건'이지, 흩어져 있으면 UI 버튼이다.
 * 왼쪽은 비워 둔다 — 사육장과 방을 보는 자리다.
 */
/**
 * ★ 책상 물건은 통째로 키운다.
 *
 * 물건마다 크기를 따로 올리려면 안쪽 좌표를 하나하나 다시 잡아야 하고,
 * 그러다 보면 물건끼리 비례가 어긋난다. 대신 다섯 개를 하나의 묶음으로 보고
 * **화면 오른쪽 아래 모서리를 기준으로** 배율만 건다. 안쪽 코드는 한 줄도
 * 안 고쳐지고, 간격도 비례도 그대로 유지되며, 물건들은 책상에 붙은 채
 * 왼쪽·위로 자란다.
 */
/**
 * ★ 손가락 기기에서는 오히려 작게 그린다.
 *
 * 얼핏 거꾸로 같지만 아니다. 폰에서는 화면 배율(cssScale)이 이미 1.7배라,
 * 여기에 1.34를 또 곱하면 아이콘 하나가 화면 높이의 17%를 먹는다.
 * 손이 편한 게 아니라 그냥 커다랗다 — 아늑한 방 앞에 앱 아이콘이 놓인다.
 *
 * 판정과 그림을 분리해뒀기 때문에(hit 참고) 그림만 줄일 수 있다.
 * 보이는 건 아담하고, 손가락은 그대로 넉넉하다. 이게 분리해둔 이유다.
 */
export const DESK_SCALE = COARSE ? 0.95 : 1.34;

export function applyDeskScale(ctx: CanvasRenderingContext2D): void {
  const ax = VIEW_W;
  const ay = LEDGE_Y();
  ctx.translate(ax, ay);
  ctx.scale(DESK_SCALE, DESK_SCALE);
  ctx.translate(-ax, -ay);
}

/** 화면 좌표 → 책상 물건 좌표. 그리는 배율과 누르는 자리가 같아야 한다. */
export function toDesk(px: number, py: number): { x: number; y: number } {
  return {
    x: VIEW_W + (px - VIEW_W) / DESK_SCALE,
    y: LEDGE_Y() + (py - LEDGE_Y()) / DESK_SCALE,
  };
}

export const notebookRect = () => ({ x: VIEW_W - 238, y: LEDGE_Y() - 16, w: 30, h: 18 });
export const carrierRect = () => ({ x: VIEW_W - 196, y: LEDGE_Y() - 22, w: 30, h: 24 });
export const giftRect = () => ({ x: VIEW_W - 150, y: LEDGE_Y() - 20, w: 26, h: 22 });
export const jarRect = () => ({ x: VIEW_W - 106, y: LEDGE_Y() - 20, w: 20, h: 22 });
export const crateRect = () => ({ x: VIEW_W - 62, y: LEDGE_Y() - 18, w: 28, h: 20 });

/**
 * ★ 이동장 — 쉬고 있는 애들이 들어 있는 곳.
 *
 * 실제로 햄스터를 옮길 때 쓰는 물건이라, 책상에 놓여 있는 것만으로
 * "안 나와 있는 애들은 저기 있다"가 설명 없이 전해진다. 창살 틈으로
 * 눈 한 쌍이 보이는 게 이 아이콘의 전부다.
 */
export function drawCarrier(ctx: CanvasRenderingContext2D, hover: boolean, resting: number): void {
  const { x, y, w, h } = carrierRect();
  const lift = hover ? 1 : 0;

  ctx.fillStyle = 'rgba(30,18,10,0.3)';
  ctx.fillRect(x - 1, y + h - 1, w + 3, 2);

  // 몸통
  ctx.fillStyle = '#7f96a8';
  ctx.fillRect(x, y + 4 - lift, w, h - 4);
  ctx.fillStyle = '#95aabb';
  ctx.fillRect(x, y + 4 - lift, w, 2);
  // 손잡이
  ctx.strokeStyle = '#6d8294';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + 5 - lift, 6, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  // 문 — 어두운 안쪽에 창살
  ctx.fillStyle = '#3b2c22';
  ctx.fillRect(x + 5, y + 8 - lift, w - 10, h - 12);
  ctx.fillStyle = '#a9bccb';
  for (let i = 0; i <= 4; i++) ctx.fillRect(x + 5 + i * ((w - 10) / 4), y + 8 - lift, 1.2, h - 12);
  ctx.fillRect(x + 5, y + 8 - lift, w - 10, 1.2);

  // 안에 있는 애의 눈 — 쉬는 애가 있을 때만
  if (resting > 0) {
    ctx.fillStyle = '#ffe9b8';
    ctx.fillRect(x + 10, y + 14 - lift, 1.6, 1.6);
    ctx.fillRect(x + 17, y + 14 - lift, 1.6, 1.6);
  }
}

/**
 * 잠깐 떴다 사라지는 한 줄.
 *
 * 소포 바로 위에 뜬다 — 화면 한가운데에 띄우면 알림창이 되지만,
 * 누른 물건 옆에 뜨면 그 물건이 대답한 것으로 읽힌다.
 */
export function drawToast(ctx: CanvasRenderingContext2D, text: string, t: number): void {
  const fade = t < 0.15 ? t / 0.15 : t > 1.7 ? Math.max(0, (2.2 - t) / 0.5) : 1;
  if (fade <= 0) return;
  const { x, y, w } = giftRect();
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = x + w / 2;
  const tw = ctx.measureText(text).width + 12;
  const ty = y - 14 - (1 - fade) * 3;
  ctx.fillStyle = 'rgba(58,38,26,0.88)';
  ctx.fillRect(cx - tw / 2, ty - 6, tw, 13);
  ctx.fillStyle = 'rgba(58,38,26,0.88)';
  ctx.beginPath();
  ctx.moveTo(cx - 3, ty + 7);
  ctx.lineTo(cx + 3, ty + 7);
  ctx.lineTo(cx, ty + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffeed0';
  ctx.fillText(text, cx, ty);
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** 쟁반 칸에 그리는 햄스터 얼굴 — 품종 차이는 색뿐이라 얼굴 하나면 된다 */
export function drawBreedIcon(
  ctx: CanvasRenderingContext2D,
  breed: BreedId,
  cx: number,
  cy: number,
  lift: boolean,
): void {
  const coat = COATS[breed];
  const R = 7.6;
  const y = cy + (lift ? -1.5 : 0);
  const ell = (ex: number, ey: number, rx: number, ry: number, col: string): void => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const s of [-1, 1]) {
    ell(cx + s * R * 0.72, y - R * 0.78, R * 0.34, R * 0.36, coat.shade);
    ell(cx + s * R * 0.72, y - R * 0.74, R * 0.19, R * 0.2, coat.ear);
  }
  ell(cx, y, R, R * 0.94, coat.base);
  ell(cx, y - R * 0.3, R * 0.8, R * 0.55, coat.light);
  ell(cx, y + R * 0.42, R * 0.4, R * 0.3, coat.belly);
  ell(cx, y + R * 0.3, R * 0.11, R * 0.09, '#c98a86');
  for (const s of [-1, 1]) {
    ell(cx + s * R * 0.42, y - R * 0.06, R * 0.14, R * 0.16, '#3a2a1e');
  }
}

/**
 * ★ 오늘 온 소포.
 *
 * 하루에 한 번만 있고, 열면 사라진다. **있고 없음이 곧 UI다** —
 * "오늘 뽑기 1/1 남음" 같은 걸 적을 필요가 없다. 책상에 상자가 있으면
 * 열 게 있는 거고, 없으면 내일이다. 세어야 하는 숫자가 하나도 안 생긴다.
 *
 * 리본이 아주 천천히 흔들린다. 가만히 있는 상자는 배경이 되지만,
 * 조금 움직이는 상자는 눈이 간다.
 */
export function drawGift(
  ctx: CanvasRenderingContext2D,
  hover: boolean,
  t: number,
  /** 0 = 방금 열었다, 1 = 다시 열 수 있다 */
  progress: number,
): void {
  const { x, y, w, h } = giftRect();
  const ready = progress >= 1;
  const lift = hover && ready ? 1.5 : 0;
  const sway = ready ? Math.sin(t * 0.0016) * 0.8 : 0;

  ctx.fillStyle = 'rgba(30,18,10,0.3)';
  ctx.fillRect(x - 1, y + h - 1, w + 3, 2);

  /**
   * ★ 열고 나면 사라지는 게 아니라 **색이 빠진다.**
   *
   * 사라지면 "없다"는 건 알겠는데 "언제 오는지"를 알 수가 없다. 자리에
   * 계속 있으면서 아래에서부터 색이 차오르면, 얼마나 남았는지가 눈금 없이
   * 보인다. 자정에 가득 찬다 — 숫자를 하나도 안 쓰고 시계를 그린 셈이다.
   *
   * 검게 만들지 않고 **채도만 뺀다.** 새까맣게 하면 고장 난 것처럼 보이고,
   * 회색으로 두면 '아직'으로 읽힌다.
   */
  ctx.save();
  if (!ready) {
    ctx.beginPath();
    ctx.rect(x - 3, y - 3, w + 6, h + 6 - (h + 6) * progress);
    ctx.clip();
    ctx.filter = 'grayscale(1) brightness(0.42)';
  }
  paintGift(ctx, x, y, w, h, lift, sway);
  ctx.restore();

  if (!ready && progress > 0.01) {
    // 차오른 부분만 원래 색으로 덮어 그린다
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 3, y + h + 3 - (h + 6) * progress, w + 6, (h + 6) * progress);
    ctx.clip();
    paintGift(ctx, x, y, w, h, lift, sway);
    ctx.restore();
  }
}

function paintGift(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  lift: number,
  sway: number,
): void {
  // 상자
  ctx.fillStyle = '#c08a58';
  ctx.fillRect(x + 1, y + 6 - lift, w - 2, h - 6);
  ctx.fillStyle = '#a97544';
  ctx.fillRect(x + 1, y + h - 3 - lift, w - 2, 3);
  // 뚜껑
  ctx.fillStyle = '#d9a56d';
  ctx.fillRect(x - 1, y + 2 - lift, w + 2, 6);
  ctx.fillStyle = '#eec191';
  ctx.fillRect(x - 1, y + 2 - lift, w + 2, 1.5);

  // 리본
  ctx.fillStyle = '#b5613f';
  ctx.fillRect(x + w / 2 - 1.6, y + 2 - lift, 3.2, h - 2);
  ctx.fillRect(x - 1, y + 4 - lift, w + 2, 2.4);
  // 매듭
  ctx.fillStyle = '#cf7350';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + w / 2 + s * 4, y + 1 - lift + sway * s, 3.4, 2.4, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#e08f6b';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + 1.5 - lift, 1.6, 0, Math.PI * 2);
  ctx.fill();
}


/**
 * 쟁반은 화면 아래쪽(베딩 높이)에 뜬다.
 * 위쪽에 띄우면 주인공을 가린다 — 고르는 동안에도 햄스터는 계속 보여야 한다.
 *
 * ★ 다만 책상 물건 위로는 올라와야 한다.
 *
 * 물건을 DESK_SCALE만큼 키우면서 제일 높은 이동장 꼭대기가
 * LEDGE_Y - 22×1.34 ≈ LEDGE_Y - 30까지 올라왔다. 예전 자리(아래끝
 * LEDGE_Y - 18)로는 쟁반이 물건들 머리를 덮는다. 아래끝을 물건 위로
 * 8px 띄운다 — 쟁반은 위로 자라니까 이 한 줄이면 몇 줄이 되든 안 겹친다.
 */
const trayY = () => LEDGE_Y() - 66;
const TRAY_H = 28;
const SLOT = 26;

/**
 * ★ 손가락 판정은 그림보다 크다.
 *
 * 마우스는 뾰족해서 2px 여유면 충분했다. 손가락은 뭉툭하고, 게다가
 * **누르는 순간 자기 손가락이 그 물건을 가린다.** 보고 누르는 게 아니라
 * 기억으로 누르는 것에 가깝다.
 *
 * 그래서 그림을 키우는 대신 판정만 키운다. 그림을 키우면 책상이 아이콘
 * 판이 되고 방이 좁아진다 — 보이는 건 그대로 아담하고, 손만 넉넉해진다.
 *
 * 30은 손가락 최소치(44px)를 이 게임 좌표로 옮긴 값이다.
 * 그림을 0.95배로 줄였으니 판정은 그만큼 되사와야 44px가 유지된다
 * (30 × 0.95 × 1.7배 ≈ 48px). 그림을 줄이면서 판정을 안 늘리면
 * 방금 고친 걸 그대로 되돌리는 셈이 된다.
 * 책상 물건이 촘촘히 붙어 있어서 무한정 넓힐 수는 없다. 옆칸을 뺏으면
 * 안 눌리는 것보다 나쁘다 — 밥통을 누르려다 선물을 열어버리는 건
 * 되돌릴 수도 없다.
 */
const TOUCH_MIN = 30;

export function hit(
  box: { x: number; y: number; w: number; h: number },
  px: number,
  py: number,
): boolean {
  if (!COARSE) {
    return px >= box.x - 2 && px <= box.x + box.w + 2 && py >= box.y - 2 && py <= box.y + box.h + 2;
  }
  // 가운데를 기준으로 최소 크기까지 넓힌다 (작은 물건일수록 많이 넓어진다)
  const gx = Math.max(0, (TOUCH_MIN - box.w) / 2);
  const gy = Math.max(0, (TOUCH_MIN - box.h) / 2);
  return (
    px >= box.x - gx &&
    px <= box.x + box.w + gx &&
    py >= box.y - gy &&
    py <= box.y + box.h + gy
  );
}

/**
 * 앞쪽 책상 모서리 — 내 물건이 놓이는 층.
 * 집이 아무리 옆으로 뻗어도 공책·먹이·보관함은 늘 손 닿는 곳에 있어야 한다.
 */
export function drawForeground(ctx: CanvasRenderingContext2D): void {
  const y = LEDGE_Y();
  ctx.fillStyle = 'rgba(30,18,10,0.3)';
  ctx.fillRect(0, y - 5, VIEW_W, 5);
  ctx.fillStyle = '#5c3f2c';
  ctx.fillRect(0, y, VIEW_W, VIEW_H - y);
  ctx.fillStyle = '#75513a';
  ctx.fillRect(0, y, VIEW_W, 3);
  ctx.fillStyle = 'rgba(255,225,190,0.1)';
  ctx.fillRect(0, y + 3, VIEW_W, 1);
}

/**
 * "여기 만질 수 있어"를 알려주는 최소한의 숨결.
 * 화살표도 튜토리얼 말풍선도 안 쓴다 — 코지 게임에서 지시문은 즉시 UI가 된다.
 * 아직 한 번도 안 써본 물건만 천천히 밝아지고, 한 번 쓰면 영원히 멈춘다.
 */
function breathe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  time: number,
): void {
  const pulse = 0.12 + Math.sin(time * 0.0018) * 0.11;
  ctx.globalAlpha = Math.max(0, pulse);
  ctx.fillStyle = 'rgba(255,238,196,1)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w * 0.78, h * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ── 먹이 항아리 ──────────────────────────────────────────
export function drawJar(
  ctx: CanvasRenderingContext2D,
  hover: boolean,
  hint: boolean,
  time: number,
): void {
  const { x, y, w, h } = jarRect();
  const top = y - (hover ? 1.5 : 0);

  ctx.fillStyle = 'rgba(40,24,14,0.4)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h, w / 2, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (hint && !hover) breathe(ctx, x, top, w, h, time);

  ctx.fillStyle = 'rgba(226,238,242,0.82)';
  ctx.fillRect(x, top + 4, w, h - 4);
  ctx.fillStyle = '#e8c98a';
  ctx.fillRect(x + 2, top + 10, w - 4, h - 11);
  ctx.fillStyle = '#d2ae6c';
  ctx.fillRect(x + 2, top + 10, w - 4, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(x + 3, top + 6, 2, h - 9);
  ctx.fillStyle = '#a8724a';
  ctx.fillRect(x - 1, top, w + 2, 5);
  ctx.fillStyle = '#c48c5e';
  ctx.fillRect(x - 1, top, w + 2, 1);

  if (hover) {
    ctx.strokeStyle = 'rgba(255,244,220,0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 1.5, top - 0.5, w + 3, h + 1);
  }
}

// ── 보관함 ──────────────────────────────────────────────
export function drawCrate(
  ctx: CanvasRenderingContext2D,
  hover: boolean,
  hasNew: boolean,
  time: number,
  /** 지금 손을 놓으면 이 안으로 돌아간다 — 상자가 받을 준비를 한다 */
  catching = false,
): void {
  const { x, y, w, h } = crateRect();
  const top = y - (hover || catching ? 1.5 : 0);

  if (catching) {
    // 위로 번지는 빛 — 물건이 여기로 빨려들어간다는 표시
    const g = ctx.createRadialGradient(x + w / 2, top, 2, x + w / 2, top, 26);
    g.addColorStop(0, 'rgba(255,224,168,0.5)');
    g.addColorStop(1, 'rgba(255,224,168,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x + w / 2 - 26, top - 26, 52, 52);
  }

  ctx.fillStyle = 'rgba(40,24,14,0.4)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h, w / 2, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();

  if (hasNew && !hover) breathe(ctx, x, top, w, h, time);

  ctx.fillStyle = '#b07a4c';
  ctx.fillRect(x, top + 3, w, h - 3);
  ctx.fillStyle = '#9a663c';
  for (let i = 1; i < 4; i++) ctx.fillRect(x + (w / 4) * i, top + 3, 1, h - 3);
  ctx.fillStyle = '#c99162';
  ctx.fillRect(x - 2, top, w + 4, 4);
  ctx.fillStyle = '#e0ab7c';
  ctx.fillRect(x - 2, top, w + 4, 1);

  if (hover || catching) {
    ctx.strokeStyle = catching ? '#ffe0a8' : 'rgba(255,244,220,0.8)';
    ctx.lineWidth = catching ? 1.5 : 1;
    ctx.strokeRect(x - 2.5, top - 0.5, w + 5, h + 1);
  }
}

// ── 열린 쟁반 ────────────────────────────────────────────

/**
 * ★ 쟁반이 여러 줄로 감긴다.
 *
 * 한 줄로 늘어놓던 시절엔 항목이 여섯 개였다. 스무 개가 되면 폭이 534px인데,
 * 화면 폭은 세로 480 고정에 비율로 정해져서 16:9면 853(들어감), 4:3이면
 * 640(빠듯), 세로로 긴 창이면 360이라 **넘친다.** 화면에 맞춰 접어야 한다.
 *
 * 아래쪽은 고정이고 위로 자란다. 쟁반이 커질수록 사육장을 더 가리지만,
 * 아래를 고정해야 손이 가는 자리가 안 바뀐다.
 */
const trayBottom = () => trayY() + TRAY_H;

interface TrayBox {
  cols: number;
  rows: number;
  x0: number;
  y0: number;
  w: number;
  h: number;
}

function trayLayout(count: number): TrayBox {
  const maxCols = Math.max(5, Math.floor((VIEW_W - 34) / SLOT));
  const cols = Math.max(1, Math.min(count, maxCols));
  const rows = Math.max(1, Math.ceil(count / cols));
  const w = cols * SLOT + 14;
  const h = rows * TRAY_H;
  return { cols, rows, w, h, x0: Math.round((VIEW_W - w) / 2), y0: trayBottom() - h };
}

/** 칸 i의 한가운데 (그리는 쪽과 누르는 쪽이 같은 식을 써야 한다) */
function slotAt(box: TrayBox, i: number): { cx: number; cy: number } {
  return {
    cx: box.x0 + 7 + (i % box.cols) * SLOT + SLOT / 2,
    cy: box.y0 + Math.floor(i / box.cols) * TRAY_H + TRAY_H / 2,
  };
}

/** 나무 쟁반. 어두운 반투명 바는 UI로 읽히고, 나무 쟁반은 물건으로 읽힌다. */
function trayPanel(ctx: CanvasRenderingContext2D, count: number): TrayBox {
  const b = trayLayout(count);

  ctx.fillStyle = 'rgba(30,18,10,0.35)';
  ctx.fillRect(b.x0 - 1, b.y0 + b.h, b.w + 2, 3);
  ctx.fillStyle = '#8a5f3c';
  ctx.fillRect(b.x0 - 2, b.y0 - 2, b.w + 4, b.h + 4);
  ctx.fillStyle = '#a97a4c';
  ctx.fillRect(b.x0 - 2, b.y0 - 2, b.w + 4, 1);
  // 밝은 안쪽 — 여기가 있어야 어두운 먹이(해바라기씨)도 보인다
  ctx.fillStyle = '#f3e4c4';
  ctx.fillRect(b.x0, b.y0, b.w, b.h);
  ctx.fillStyle = '#e4d0aa';
  ctx.fillRect(b.x0, b.y0 + b.h - 3, b.w, 3);
  // 줄 사이 칸막이
  ctx.fillStyle = 'rgba(160,120,80,0.22)';
  for (let r = 1; r < b.rows; r++) ctx.fillRect(b.x0, b.y0 + r * TRAY_H, b.w, 1);
  return b;
}

function label(ctx: CanvasRenderingContext2D, text: string, count = 1): void {
  const top = trayLayout(count).y0;
  ctx.font = '7px sans-serif';
  ctx.textAlign = 'center';
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = 'rgba(58,38,26,0.85)';
  ctx.fillRect(VIEW_W / 2 - w / 2, top - 15, w, 11);
  ctx.fillStyle = '#ffeed0';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, VIEW_W / 2, top - 9);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function slotIndex(count: number, px: number, py: number): number {
  const b = trayLayout(count);
  if (py < b.y0 - 2 || py > b.y0 + b.h + 2) return -1;
  const col = Math.floor((px - b.x0 - 7) / SLOT);
  const row = Math.floor((py - b.y0) / TRAY_H);
  if (col < 0 || col >= b.cols || row < 0 || row >= b.rows) return -1;
  const i = row * b.cols + col;
  return i < count ? i : -1;
}

function highlight(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.fillStyle = 'rgba(180,130,70,0.22)';
  ctx.fillRect(cx - SLOT / 2 + 2, cy - TRAY_H / 2 + 2, SLOT - 4, TRAY_H - 5);
}

/**
 * ★ 아직 없는 것은 검은 실루엣으로.
 *
 * 별도 도감 화면을 만들었다가 지웠다. 없는 걸 보게 되는 순간이 '책을 펴서
 * 구경할 때'가 아니라 **'뭘 줄까 고를 때'**여야 갖고 싶어지기 때문이다.
 * 같은 이유로 실루엣은 진짜 그 물건의 모양이어야 한다 — 물음표 상자는
 * 아무것도 안 알려주지만, 실루엣은 '뭔가 길쭉한 게 있구나'를 알려준다.
 *
 * filter로 원본 그리기 코드를 그대로 검게 만든다. 실루엣을 따로 그리면
 * 언젠가 본체와 어긋나고, 그때부터 쟁반이 거짓말을 하게 된다.
 */
function silhouette(ctx: CanvasRenderingContext2D, paint: () => void): void {
  ctx.save();
  ctx.filter = 'brightness(0)';
  ctx.globalAlpha = 0.28;
  paint();
  ctx.restore();
}

export function drawFoodTray(
  ctx: CanvasRenderingContext2D,
  hoverIdx: number,
  owned: ReadonlySet<FoodId>,
): void {
  const box = trayPanel(ctx, FOOD_IDS.length);
  FOOD_IDS.forEach((id, i) => {
    const { cx, cy } = slotAt(box, i);
    const have = owned.has(id);
    if (i === hoverIdx && have) highlight(ctx, cx, cy);
    const paint = (): void =>
      FOODS[id].draw(ctx, cx, cy + (i === hoverIdx && have ? -1.5 : 0), 1.35);
    if (have) paint();
    else silhouette(ctx, paint);
  });
}

export const foodTrayIndex = (px: number, py: number) => slotIndex(FOOD_IDS.length, px, py);

/**
 * 가구 쟁반 — 가진 것과 아직 없는 것을 함께 보여준다.
 *
 * 이미 사육장에 놓아둔 것은 목록에서 빠진다(가진 것 중에서만). 없는 것은
 * 늘 실루엣으로 남는다 — 자리가 고정돼 있어야 "저 자리 게 생겼네"가 보인다.
 */
export function drawShelfTray(
  ctx: CanvasRenderingContext2D,
  hoverIdx: number,
  owned: ReadonlySet<FurnitureId>,
  /** 사육장에 몇 개나 나가 있는지 (여러 개 놓이는 것만 숫자가 붙는다) */
  placedCount: ReadonlyMap<FurnitureId, number>,
  /** 지금 (하나 더) 놓을 수 있는가 — 판단은 habitat.canPlace 한 군데서만 한다 */
  canPlace: (id: FurnitureId) => boolean,
): void {
  const box = trayPanel(ctx, FURNITURE_IDS.length);
  FURNITURE_IDS.forEach((id, i) => {
    const { cx, cy } = slotAt(box, i);
    const have = owned.has(id);
    const usable = have && canPlace(id);
    if (i === hoverIdx && usable) highlight(ctx, cx, cy);
    const paint = (): void => drawShelfIcon(ctx, id, cx, cy + 5, i === hoverIdx && usable);
    if (!have) {
      silhouette(ctx, paint);
      return;
    }
    /**
     * 이미 나가 있는 것은 흐리게. '없는 것'(실루엣)과는 다른 상태다 —
     * 실루엣은 아직 못 가진 것이고, 이건 가졌는데 지금 쓰고 있는 것이다.
     * 둘을 같은 모양으로 보여주면 왜 안 눌리는지 알 수가 없다.
     */
    if (!usable) {
      ctx.save();
      ctx.globalAlpha = 0.32;
      paint();
      ctx.restore();
      return;
    }
    paint();
    /**
     * 몇 개 놓았는지 작게 적는다 (선반처럼 여러 개 놓이는 것만 해당).
     * 두 개부터 적는다. 하나일 때 '1'이 붙으면 세라는 뜻으로 읽힌다.
     */
    const n = placedCount.get(id) ?? 0;
    if (n >= 2) {
      ctx.font = '6px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(94,66,42,0.85)';
      ctx.fillText(`${n}`, cx + SLOT / 2 - 2, cy + TRAY_H / 2 - 3);
      ctx.textAlign = 'left';
    }
  });
}

export const shelfTrayIndex = (px: number, py: number) =>
  slotIndex(FURNITURE_IDS.length, px, py);

/**
 * 햄스터 쟁반.
 *
 * 나와 있는 애는 테두리를 둘러 표시한다 — 흐리게 하면 '못 쓰는 것'으로
 * 읽히는데, 나와 있는 건 못 쓰는 게 아니라 **지금 쓰고 있는** 것이다.
 * 그래서 가구(나가 있으면 흐림)와 반대로 그린다.
 */
export function drawHamsterTray(
  ctx: CanvasRenderingContext2D,
  hoverIdx: number,
  owned: ReadonlySet<BreedId>,
  active: readonly BreedId[],
): void {
  const box = trayPanel(ctx, BREED_IDS.length);
  BREED_IDS.forEach((id, i) => {
    const { cx, cy } = slotAt(box, i);
    const have = owned.has(id);
    const out = active.includes(id);
    if (i === hoverIdx && have) highlight(ctx, cx, cy);
    const paint = (): void => drawBreedIcon(ctx, id, cx, cy, i === hoverIdx && have);
    if (have) {
      paint();
      if (out) {
        // 지금 나와 있음 — 발밑에 밝은 밑줄
        ctx.fillStyle = '#c98f5a';
        ctx.fillRect(cx - 7, cy + TRAY_H / 2 - 4, 14, 1.6);
      }
    } else {
      silhouette(ctx, paint);
    }
  });
}

export const hamsterTrayIndex = (px: number, py: number) => slotIndex(BREED_IDS.length, px, py);

export const drawHamsterLabel = (
  ctx: CanvasRenderingContext2D,
  breed: BreedId,
  owned: ReadonlySet<BreedId>,
  active: readonly BreedId[],
) =>
  label(
    ctx,
    !owned.has(breed)
      ? '???'
      : active.includes(breed)
        ? `${COATS[breed].name} — 나와 있음`
        : COATS[breed].name,
    BREED_IDS.length,
  );

/**
 * 바닥재 고르기.
 * 방의 인상을 제일 크게 바꾸는 꾸미기 축인데 코드는 제일 싸다.
 */
export function drawSubstrateTray(ctx: CanvasRenderingContext2D, hoverIdx: number): void {
  const box = trayPanel(ctx, SUBSTRATE_IDS.length);
  SUBSTRATE_IDS.forEach((id, i) => {
    const s = SUBSTRATES[id];
    const { cx, cy } = slotAt(box, i);
    const top = cy - TRAY_H / 2;
    if (i === hoverIdx) highlight(ctx, cx, cy);
    ctx.fillStyle = s.body;
    ctx.fillRect(cx - 8, top + 8, 16, 12);
    ctx.fillStyle = s.top;
    ctx.fillRect(cx - 8, top + 6, 16, 3);
    ctx.fillStyle = s.speck;
    for (let k = 0; k < 7; k++) {
      ctx.fillRect(cx - 7 + ((k * 5) % 14), top + 11 + ((k * 3) % 8), 1, 1);
    }
    ctx.fillStyle = s.dark;
    ctx.fillRect(cx - 8, top + 18, 16, 2);
  });
}

export const substrateTrayIndex = (px: number, py: number) =>
  slotIndex(SUBSTRATE_IDS.length, px, py);

/*
 * 벽지(껍데기) 쟁반은 없다.
 * 네 색이 전부 서로 어울리게 골라져 있어서 고를 게 없고,
 * 고를 게 없는 걸 고르게 하면 그건 선택이 아니라 일이 된다.
 * 대신 방을 떼어 놓을 때마다 새 색이 나온다 — 결정이 아니라 선물에 가깝게.
 */

/** 이름만 띄운다. 설명도 수치도 없다 — 뭘 고르는지만 알면 된다. */
/**
 * 아직 없는 것은 이름도 안 알려준다.
 *
 * 실루엣만 보고 뭔지 알아맞히는 재미가 절반이다. 이름까지 적어주면
 * 그냥 '잠긴 항목 목록'이 되고, 그건 갖고 싶게 만들지 않는다.
 */
export const drawFoodLabel = (
  ctx: CanvasRenderingContext2D,
  food: FoodId,
  owned: ReadonlySet<FoodId>,
) => label(ctx, owned.has(food) ? FOODS[food].name : '???', FOOD_IDS.length);
export const drawFurnitureLabel = (
  ctx: CanvasRenderingContext2D,
  id: FurnitureId,
  owned: ReadonlySet<FurnitureId>,
) => label(ctx, owned.has(id) ? FURNITURE[id].name : '???', FURNITURE_IDS.length);
export const drawSubstrateLabel = (ctx: CanvasRenderingContext2D, i: number) =>
  label(ctx, SUBSTRATES[SUBSTRATE_IDS[i]!]!.name, SUBSTRATE_IDS.length);
