import { COATS } from '../content/breeds';
import { FOODS } from '../content/foods';
import { FURNITURE } from '../content/furniture';
import { clamp } from '../core/math';
import type { GiftItem } from '../sim/gift';

import { drawBreedIcon } from './desk';
import { VIEW_H, VIEW_W } from './screen';

/**
 * ★ 소포에서 나온 것을 보여주는 순간.
 *
 * 뽑기의 재미는 확률표가 아니라 **열리는 순간**에 있다. 그래서 결과를
 * 쟁반에 조용히 추가하고 마는 대신, 화면을 잠깐 멈추고 그것만 보게 한다.
 *
 * 다만 아주 짧다. 축포도 등급 연출도 없다 — 그런 건 '대단한 걸 뽑았다'를
 * 말하려고 있는 건데, 이 게임엔 대단한 것과 안 대단한 것이 없다.
 * 그냥 오늘 하나 늘었다는 사실만 보여주고 비켜준다.
 */

const IN = 0.28; // 떠오르는 시간(초)

export interface Reveal {
  item: GiftItem;
  t: number;
}

export function drawReveal(ctx: CanvasRenderingContext2D, r: Reveal): void {
  const p = clamp(r.t / IN, 0, 1);
  const ease = 1 - (1 - p) ** 3;

  // 방을 살짝 죽인다 — 덮는 게 아니라 물러나게 한다
  ctx.fillStyle = `rgba(28,18,10,${0.42 * ease})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2 - 6;
  const rise = (1 - ease) * 10;

  ctx.save();
  ctx.globalAlpha = ease;

  // 뒤에서 번지는 빛 — 물건이 어두운 배경에서 떠오르게 한다
  const glow = ctx.createRadialGradient(cx, cy - rise, 2, cx, cy - rise, 62);
  glow.addColorStop(0, 'rgba(255,231,182,0.5)');
  glow.addColorStop(1, 'rgba(255,231,182,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 70, cy - rise - 70, 140, 140);

  const item = r.item;
  const name =
    item.kind === 'food'
      ? FOODS[item.id].name
      : item.kind === 'hamster'
        ? COATS[item.id].name
        : FURNITURE[item.id].name;

  ctx.save();
  ctx.translate(cx, cy - rise);
  if (item.kind === 'food') {
    FOODS[item.id].draw(ctx, 0, 0, 4.6);
  } else if (item.kind === 'hamster') {
    ctx.scale(2.2, 2.2);
    drawBreedIcon(ctx, item.id, 0, 0, false);
  } else {
    // 가구는 바닥에 서 있는 물건이라 발끝 기준으로 그린다
    const def = FURNITURE[item.id];
    const s = Math.min(1.5, 62 / Math.max(def.w, def.h));
    ctx.scale(s, s);
    def.draw(ctx, -def.w / 2, def.h / 2, 0);
  }
  ctx.restore();

  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffeed0';
  ctx.fillText(name, cx, cy + 44 - rise);
  ctx.font = '7px sans-serif';
  ctx.fillStyle = 'rgba(255,238,208,0.55)';
  const sub =
    item.kind === 'food'
      ? '새로 줄 수 있는 먹이'
      : item.kind === 'hamster'
        ? '새 친구가 왔다'
        : '새로 놓을 수 있는 물건';
  ctx.fillText(sub, cx, cy + 58 - rise);
  ctx.textAlign = 'left';

  ctx.restore();
}
