import { notebookRect } from './desk';
import { P } from './palette';

/**
 * 케이지 앞 턱에 놓인 작은 공책.
 *
 * 안 읽은 일기가 있으면 아주 천천히 밝아졌다 어두워진다.
 * 빨간 배지 같은 건 절대 안 붙인다 — 그건 알림이지 초대가 아니다.
 */
export function drawNotebook(
  ctx: CanvasRenderingContext2D,
  opts: { hover: boolean; unread: boolean; time: number },
): void {
  const { x, y, w, h } = notebookRect();
  const lift = opts.hover ? 1.5 : 0;
  const top = y - lift;

  // 책상에 닿는 그림자
  ctx.fillStyle = 'rgba(40,24,14,0.4)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h, w / 2 + 1, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 안 읽은 게 있으면 숨쉬듯 번진다. 빨간 배지는 알림이지 초대가 아니다.
  if (opts.unread) {
    const pulse = 0.2 + Math.sin(opts.time * 0.0016) * 0.16;
    ctx.globalAlpha = Math.max(0, pulse);
    ctx.fillStyle = 'rgba(255,236,192,1)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, top + h / 2, w * 0.62, h * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // 종이 더미
  ctx.fillStyle = '#efe2c8';
  ctx.fillRect(x + 2, top + 3, w - 4, h - 5);
  ctx.fillStyle = '#e2d2b2';
  for (let i = 1; i <= 3; i++) ctx.fillRect(x + 2, top + 3 + i * 3, w - 4, 1);

  // 표지 (천 커버)
  ctx.fillStyle = '#b9705a';
  ctx.fillRect(x, top, w, h - 3);
  ctx.fillStyle = '#cd8468';
  ctx.fillRect(x, top, w, 2);
  ctx.fillStyle = '#9d5a48';
  ctx.fillRect(x, top + h - 5, w, 2);

  // 책등
  ctx.fillStyle = '#8f4f3f';
  ctx.fillRect(x, top, 3, h - 3);

  // 끈 책갈피
  ctx.fillStyle = '#e8c48c';
  ctx.fillRect(x + w - 8, top, 2, h + 2 - lift);

  if (opts.hover) {
    ctx.strokeStyle = 'rgba(255,244,220,0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, top - 0.5, w + 1, h - 2);
  }

  // 앞 턱에 닿은 면
  ctx.fillStyle = P.frameLight;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(x, y + h - 3, w, 1);
  ctx.globalAlpha = 1;
}

export function notebookHit(px: number, py: number): boolean {
  const { x, y, w, h } = notebookRect();
  return px >= x - 2 && px <= x + w + 2 && py >= y - 4 && py <= y + h + 2;
}
