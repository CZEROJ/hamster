import { clamp } from '../core/math';
import { COARSE, VIEW_H, VIEW_W } from './screen';

/**
 * 물건을 놓는 자리 — 화면 아래 가운데.
 *
 * ★ 왜 있어야 하냐면, 지금까지 '치우기'가 보이지 않는 규칙이었다.
 *
 *   예전 규칙은 "칸 밖에 놓으면 지워진다"였다. 알려주지도, 보이지도
 *   않는다. 그래서 최악의 조합이 만들어졌다 — 치우고 싶은 사람은
 *   방법을 못 찾고, 그냥 옮기려던 사람은 실수로 치운다.
 *
 * ★ 쓰레기통이 아니라 상자다.
 *
 *   이 게임에서 가구를 치우는 건 아무것도 파괴하지 않는다. 해금 방식이라
 *   치운 물건은 그대로 장난감통으로 돌아가고 내일 다시 꺼낼 수 있다.
 *   빨간 쓰레기통은 결과에 대해 거짓말을 하는 셈이고, 그 거짓말은 공짜가
 *   아니다 — 치우는 게 파괴처럼 느껴지면 사람들은 배치를 안 바꾼다.
 *   며칠에 걸쳐 방을 만지작거리는 게 전부인 게임에서 그건 치명적이다.
 *
 *   그래서 따뜻한 색이고, 그림은 열린 상자다.
 */

/** 햄스터는 상자가 아니라 이동장으로 간다 — 물건이 아니니까 */
export type DropKind = 'crate' | 'carrier';

const W = 84;
const H = 30;

/**
 * ★ 가로 자리는 '책상에서 내 물건이 없는 쪽의 한가운데'다.
 *
 * 그냥 화면 한가운데(VIEW_W/2)에 뒀더니 폰에서 공책·이동장 자리와
 * 겹쳤다. 책상 물건은 오른쪽 끝에서부터 238만큼을 쓰니, 그 왼쪽
 * 구간의 한가운데로 잡으면 화면이 넓든 좁든 절대 안 겹친다.
 */
export function dropZoneRect(): { x: number; y: number; w: number; h: number } {
  /**
   * 세로는 사육장 **아래**, 책상 위. 여기가 중요하다.
   *
   * 처음엔 화면 아래에서 44 높이로 띄웠는데, 폰은 화면이 낮아서
   * 이게 사육장 바닥까지 올라왔다. 그래서 **사육장 한가운데에 물건을
   * 놓으면 놓이는 게 아니라 상자로 들어갔다.** 옮기려던 게 치워졌다.
   *
   * 손가락 기기는 아래를 조금 더 비운다 — 화면 맨 아래는 홈 제스처
   * 바가 먹는 구간이라, 거기서 손을 떼면 앱이 나가버린다.
   */
  const bottom = VIEW_H - (COARSE ? 14 : 8);
  return { x: (VIEW_W - 238) / 2 - W / 2, y: bottom - H, w: W, h: H };
}

export function overDropZone(px: number, py: number): boolean {
  const r = dropZoneRect();
  // 판정은 그림보다 조금 넉넉하되, 위로는 안 넓힌다 — 위가 사육장이다
  return px >= r.x - 10 && px <= r.x + r.w + 10 && py >= r.y - 4 && py <= r.y + r.h + 8;
}

/**
 * @param t     0→1 나타나는 정도 (툭 튀어나오면 놀란다)
 * @param over  지금 이 위에 손이 있는가
 */
export function drawDropZone(
  ctx: CanvasRenderingContext2D,
  kind: DropKind,
  t: number,
  over: boolean,
): void {
  const a = clamp(t, 0, 1);
  if (a <= 0.01) return;

  const r = dropZoneRect();
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const grow = over ? 1.08 : 1;

  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy);
  ctx.scale(grow, grow);
  // 아래에서 올라오듯 — 방 밖에서 튀어나온 게 아니라 책상에서 떠오른 것
  ctx.translate(0, (1 - a) * 14);

  /**
   * ★ 번짐은 진짜 blur가 아니라 겹친 원이다.
   *   ctx.filter='blur()'는 프레임마다 화면을 다시 합성해서 폰에서 눈에
   *   띄게 버벅인다. 부드러운 방사 그라데이션 두 겹이면 같은 인상을 준다.
   */
  const reach = over ? 96 : 78;
  const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, reach);
  const power = over ? 0.5 : 0.3;
  glow.addColorStop(0, `rgba(255,196,120,${power})`);
  glow.addColorStop(0.45, `rgba(255,178,96,${power * 0.34})`);
  glow.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-reach, -reach, reach * 2, reach * 2);

  // 바탕 — 따뜻한 나무색 알약
  roundRect(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 13);
  ctx.fillStyle = over ? 'rgba(96,64,38,0.94)' : 'rgba(74,50,32,0.82)';
  ctx.fill();
  ctx.lineWidth = over ? 2 : 1.4;
  ctx.strokeStyle = over ? 'rgba(255,206,142,0.95)' : 'rgba(214,164,106,0.6)';
  ctx.stroke();

  if (kind === 'crate') drawOpenCrate(ctx, -r.w / 2 + 17, 0, over);
  else drawCarrierMark(ctx, -r.w / 2 + 17, 0, over);

  ctx.fillStyle = over ? '#ffe6c2' : '#d8bb92';
  ctx.font = '600 10px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(kind === 'crate' ? '상자에 넣기' : '쉬러 가기', -r.w / 2 + 30, 1);

  ctx.restore();
}

/** 뚜껑이 열린 상자 — 위에 있으면 더 크게 열린다 */
function drawOpenCrate(ctx: CanvasRenderingContext2D, x: number, y: number, over: boolean): void {
  const lid = over ? 7 : 3.5;
  ctx.save();
  ctx.translate(x, y);

  // 몸통
  ctx.fillStyle = '#a9743f';
  roundRect(ctx, -9, -2, 18, 13, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(-9, -2, 18, 3); // 안쪽 그늘 — 열려 있다는 표시

  // 널 자국
  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.fillRect(-3.5, 2, 1.2, 8);
  ctx.fillRect(2.3, 2, 1.2, 8);

  // 뚜껑 — 뒤로 젖혀진다
  ctx.save();
  ctx.translate(0, -3);
  ctx.rotate((-lid * Math.PI) / 180);
  ctx.fillStyle = '#c08a4e';
  roundRect(ctx, -10, -4.5, 20, 4.5, 1.6);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** 이동장 — 햄스터가 쉬러 가는 자리 */
function drawCarrierMark(ctx: CanvasRenderingContext2D, x: number, y: number, over: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = over ? '#8fb6cc' : '#7ba2b8';
  roundRect(ctx, -9, -5, 18, 13, 2.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,26,32,0.72)';
  for (let i = 0; i < 4; i++) ctx.fillRect(-5.5 + i * 3, -2, 1.5, 7);
  // 손잡이
  ctx.strokeStyle = over ? '#8fb6cc' : '#7ba2b8';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, -5, 4.2, Math.PI, 0);
  ctx.stroke();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
