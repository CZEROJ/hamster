import { clamp } from '../core/math';
import { beginAction } from './behavior';
import type { Hamster, WorldCtx } from './types';

/**
 * ★ System 1의 심장: "알아차리는 순간"
 *
 * 1. 하던 걸 계속한다 (0.5~2.0초)   ← 이 지연이 트릭의 전부다
 * 2. 멈춘다. 귀가 선다.              (= "…?")
 * 3. 고개를 돌린다.
 * 4. 두 발로 선다.
 * 5. 다가오거나, 하던 일로 돌아간다.  (친밀도에 따라)
 *
 * 즉시 반응하면 자판기, 늦게 반응하면 생물이다.
 * 반응 앞에 붙는 정적이 기대를 만들고, 기대가 감정을 만든다.
 */

export function triggerNotice(h: Hamster, ctx: WorldCtx): void {
  if (h.asleep) return;
  if (h.notice !== 'none') return;
  if (h.noticeCooldown > 0) return;

  h.notice = 'delay';
  h.noticeT = 0;
  // 낯가리는 동안은 알아차리는 데 더 오래 걸린다
  h.noticeDur = h.shy > 0 ? ctx.rng.range(2.5, 4.5) : ctx.rng.range(0.5, 2.0);
}

/** true를 반환하면 이 틱에는 일반 행동 갱신을 하지 않는다(연출이 몸을 잡고 있음). */
export function updateNotice(h: Hamster, ctx: WorldCtx): boolean {
  if (h.noticeCooldown > 0) h.noticeCooldown -= ctx.dt;
  if (h.notice === 'none') return false;

  h.noticeT += ctx.dt;
  const done = h.noticeT >= h.noticeDur;

  switch (h.notice) {
    // ① 아직 모른다. 하던 걸 계속한다.
    case 'delay':
      if (done) {
        h.notice = 'freeze';
        h.noticeT = 0;
        h.noticeDur = 0.38;
        ctx.emit('hamster.noticed');
      }
      return false;

    // ② "…?" 완전 정지. 귀가 선다.
    case 'freeze':
      h.vx = 0;
      h.burst = 0;
      h.moveTarget = null;
      h.earPerk = 1;
      h.attention = Math.max(h.attention, 0.75);
      if (done) {
        h.notice = 'turn';
        h.noticeT = 0;
        h.noticeDur = 0.55;
      }
      return true;

    // ③ 고개를 돌린다. (attention이 1이면 시선 시스템이 알아서 플레이어를 향한다)
    case 'turn':
      h.vx = 0;
      h.attention = 1;
      h.standTarget = 0;
      if (done) {
        h.notice = 'stand';
        h.noticeT = 0;
        h.noticeDur = 1.5;
      }
      return true;

    // ④ 두 발로 선다.
    case 'stand':
      h.vx = 0;
      h.attention = 1;
      h.standTarget = 1;
      if (done) {
        h.notice = 'settle';
        h.noticeT = 0;
        h.noticeDur = 0;
      }
      return true;

    // ⑤ 다가올까, 말까. 여기서 거절이 가능해야 승낙이 의미를 갖는다.
    case 'settle': {
      // 낯가리는 동안은 절대 먼저 다가오지 않는다.
      // 첫 만남부터 살가우면 '내 햄스터'가 아니라 설정된 마스코트가 된다.
      const p = h.shy > 0 ? 0 : 0.2 + 0.6 * ctx.familiarity;
      if (ctx.pointer.inside && ctx.rng.chance(p)) {
        beginAction(h, ctx, 'approach', 6);
        h.moveTarget = clamp(ctx.pointer.x, ctx.minX, ctx.maxX);
        ctx.emit('hamster.approached');
      } else {
        h.standTarget = 0;
      }
      h.notice = 'none';
      h.noticeCooldown = ctx.rng.range(22, 70);
      return false;
    }

    default:
      return false;
  }
}
