import { clamp, damp } from '../core/math';
import { boundsOf, DESK_Y, ROOM_ABOVE_DESK, type Cell } from '../world';
import { VIEW_H, VIEW_W } from './screen';

/**
 * 카메라 — 햄스터를 따라간다.
 *
 * 한때 '전체 보기' 모드가 따로 있었다. 집을 여러 방으로 넓힐 수 있던 시절,
 * 넓힌 집을 한눈에 볼 데가 필요해서였다. 방이 하나가 되면서 볼 게 없어졌다.
 *
 * ★ 데드존이 중요하다.
 *   햄스터는 탁 튀어나갔다 탁 멈춘다(버스트-정지). 카메라가 그걸 그대로 따라가면
 *   화면이 계속 흔들려서 멀미가 난다. 화면 가운데 상자 안에서 움직일 때는
 *   카메라가 아예 움직이지 않는다.
 */
/** 따라가기에서 이보다 더 당기지는 않는다 — 얼굴만 커지고 방이 안 보이면 답답하다 */
const MAX_ZOOM = 1.35;
const PAD_X = 18;
const PAD_TOP = 14;
/** 아래쪽은 책상이 차지한다 */
const PAD_BOTTOM = 42;

/** 이 상자 안에서 움직이면 카메라는 가만히 있는다 (화면 비율) */
const DEAD_W = 0.22;
const DEAD_H = 0.16;

export class Camera {
  scale = 1;
  x = 0;
  y = 0;
  /** 데드존을 통과한 '진짜' 목표 */
  private tx = 0;
  private ty = 0;
  private first = true;

  update(cells: readonly Cell[], dt: number, focus: { x: number; y: number }): void {
    const b = boundsOf(cells);
    const availW = VIEW_W - PAD_X * 2;
    const availH = VIEW_H - PAD_TOP - PAD_BOTTOM;

    /**
     * ★ 사육장만 맞추면 안 되고, 그 위 벽까지 맞춰야 한다.
     *
     * 예전엔 사육장 크기만 보고 줌을 정했다. 그러면 화면이 낮아져도
     * 줌은 그대로여서, 사육장 위쪽 벽이 화면 밖으로 밀려났다.
     * 폰을 눕히면 시계와 달력이 잘린 게 이것 때문이다.
     *
     * 책상선은 화면 78% 지점에 붙어 있으니(아래 deskFloor), 책상 위로
     * 쓸 수 있는 화면은 VIEW_H × 0.78이다. 여기에 ROOM_ABOVE_DESK만큼의
     * 월드가 들어가려면 줌이 이 값을 넘으면 안 된다.
     *
     * 화면이 넉넉하면 이 항은 MAX_ZOOM보다 커서 아무 영향이 없다 —
     * PC는 예전과 똑같이 동작하고, 좁은 화면에서만 조용히 물러난다.
     */
    const roomFit = (VIEW_H * 0.78) / ROOM_ABOVE_DESK;

    // 방이 화면보다 작으면 다가가서 본다. 멀리서 보면 아늑한 게 아니라 그냥 멀다.
    const targetScale = clamp(
      Math.min(availW / b.w, availH / b.h, roomFit),
      0.62,
      MAX_ZOOM,
    );
    this.applyDeadZone(focus, targetScale);

    // 사육장 바깥 허공을 너무 많이 보여주지 않는다
    const halfW = availW / targetScale / 2;
    const halfH = availH / targetScale / 2;
    const cx = clampRange(this.tx, b.x + halfW, b.x + b.w - halfW);
    let cy = clampRange(this.ty, b.y + halfH, b.y + b.h - halfH);

    /**
     * ★ 책상선을 화면 아래쪽에 붙들어 둔다.
     *
     * 세로로 긴 창에서는 책상이 화면의 절반을 먹었다. 책상은 갈색 널판이라
     * 볼 게 없고, 그만큼 벽(소품이 있는 쪽)이 밀려난다.
     * 책상이 아래 띠로만 남게 카메라를 눌러두면, 창이 길수록 벽이 더 보인다.
     */
    const deskFloor = DESK_Y - (VIEW_H * 0.78 - this.cy()) / targetScale;
    cy = Math.min(cy, deskFloor);

    if (this.first) {
      this.scale = targetScale;
      this.x = cx;
      this.y = cy;
      this.tx = cx;
      this.ty = cy;
      this.first = false;
      return;
    }
    // 툭 튀면 안 된다. 부드럽게 물러나고 부드럽게 다가간다.
    this.scale = damp(this.scale, targetScale, 0.22, dt);
    this.x = damp(this.x, cx, 0.28, dt);
    this.y = damp(this.y, cy, 0.28, dt);
  }

  private applyDeadZone(focus: { x: number; y: number }, scale: number): void {
    const dw = ((VIEW_W * DEAD_W) / scale) * 0.5;
    const dh = ((VIEW_H * DEAD_H) / scale) * 0.5;
    if (focus.x > this.tx + dw) this.tx = focus.x - dw;
    else if (focus.x < this.tx - dw) this.tx = focus.x + dw;
    if (focus.y > this.ty + dh) this.ty = focus.y - dh;
    else if (focus.y < this.ty - dh) this.ty = focus.y + dh;
  }

  private cx(): number {
    return VIEW_W / 2;
  }

  private cy(): number {
    return (VIEW_H - PAD_BOTTOM + PAD_TOP) / 2;
  }

  apply(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.cx(), this.cy());
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.x, -this.y);
  }

  release(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }

  /** 월드 → 뷰. toWorld의 역함수. */
  toView(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x) * this.scale + this.cx(),
      y: (wy - this.y) * this.scale + this.cy(),
    };
  }

  toWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.cx()) / this.scale + this.x,
      y: (sy - this.cy()) / this.scale + this.y,
    };
  }

  /** 지금 보이는 월드 범위 — 배경이 그릴 구간을 정하는 데 쓴다 */
  viewRange(): { left: number; right: number; top: number; bottom: number } {
    const a = this.toWorld(0, 0);
    const b = this.toWorld(VIEW_W, VIEW_H);
    return { left: a.x, right: b.x, top: a.y, bottom: b.y };
  }
}

function clampRange(v: number, lo: number, hi: number): number {
  if (lo > hi) return (lo + hi) / 2;
  return clamp(v, lo, hi);
}
