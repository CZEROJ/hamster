import { FOODS, type FoodId } from '../content/foods';
import { FURNITURE, type FurnitureId } from '../content/furniture';
import { plankOf, planksJoin } from '../sim/floors';
import type { Habitat, PlacedFurniture } from '../sim/habitat';
import { groundY, MODULE_H, MODULE_W, originX, originY, type Cell } from '../world';

/**
 * 놓인 가구를 그린다.
 *
 * 측면 단면도라서 배치는 '어느 방 + x 하나'로 끝난다. 이게 설계상 큰 이득이다 —
 * 격자도, 회전도, 충돌 판정도 필요 없고, 그녀는 '어느 방에 둘까'만 생각하면 된다.
 * 꾸미기의 즐거움은 자유도가 아니라 '내 방이 됐다'는 감각에서 온다.
 */
export function drawFurniture(
  ctx: CanvasRenderingContext2D,
  hab: Habitat,
  t: number,
  dragging: number,
  spinOf?: (i: number) => number,
): void {
  hab.furniture.forEach((f, i) => {
    if (i === dragging) return; // 드래그 중인 건 맨 위에 따로 그린다
    drawOne(ctx, f, t, false, spinOf?.(i) ?? 0, joinsOf(hab, f));
  });
}

/**
 * 햄스터보다 뒤에 그리는 부분 — 러닝휠의 앞테 같은 것.
 *
 * 가구를 전부 햄스터 앞에 그리면 햄스터가 늘 가구 뒤에 가려지고,
 * 전부 뒤에 그리면 무엇에도 '들어갈' 수 없다. 그래서 물건이 스스로
 * 앞으로 나올 부분을 정하게 했다 — 대부분은 그런 부분이 없다.
 */
export function drawFurnitureFront(
  ctx: CanvasRenderingContext2D,
  hab: Habitat,
  t: number,
  dragging: number,
  spinOf?: (i: number) => number,
): void {
  hab.furniture.forEach((f, i) => {
    if (i === dragging) return;
    const def = FURNITURE[f.id];
    if (!def.drawFront) return;
    def.drawFront(ctx, originX(f.cx) + f.x, groundY(f.cy) - (f.lift ?? 0), t, spinOf?.(i) ?? 0);
  });
}

/**
 * ★ 손에 들린 물건.
 *
 * 예전엔 사육장 안에 들어갔을 때만 그려졌다. 그래서 쟁반에서 눌러 집은
 * 순간에는 화면에 아무 변화가 없었고, "눌렸나?" 싶어서 다시 누르게 됐다.
 * **집었으면 집힌 게 보여야 한다.** 커서가 어디에 있든.
 *
 * 들린 물건은 세 가지로 '들려 있음'을 말한다:
 *   · 살짝 커진다 (가까이 왔으니까)
 *   · 커서보다 조금 늦게 따라오며 기울어진다 (무게)
 *   · 바닥이 아니라 **커서 아래**에 그림자가 진다 (떠 있으니까)
 */
export function drawCarried(
  ctx: CanvasRenderingContext2D,
  id: FurnitureId,
  x: number,
  y: number,
  tilt: number,
  t: number,
): void {
  const def = FURNITURE[id];
  ctx.save();
  // 손 그림자 — 물건 바로 밑에 작게. 바닥 그림자와 달라야 '떠 있다'가 된다.
  ctx.fillStyle = 'rgba(30,18,10,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y + 6, def.w * 0.34, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(1.12, 1.12);
  def.draw(ctx, -def.w / 2, def.h / 2, t);
  ctx.restore();
}

/**
 * 놓일 자리 미리보기 — 바닥에 옅게 깔리는 자국.
 *
 * 들린 물건만 있으면 '어디에 놓이는지'를 커서로 짐작해야 한다.
 * 착지 자국이 있으면 손이 아니라 자리를 보게 되고, 그게 배치를 쉽게 만든다.
 */
export function drawDropGhost(
  ctx: CanvasRenderingContext2D,
  id: FurnitureId,
  wx: number,
  gy: number,
): void {
  const def = FURNITURE[id];
  ctx.save();
  ctx.globalAlpha = 0.32;
  def.draw(ctx, wx, gy, 0);
  ctx.restore();
  ctx.fillStyle = 'rgba(120,88,52,0.35)';
  ctx.beginPath();
  ctx.ellipse(wx + def.w / 2, gy + 1, def.w * 0.5, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawOne(
  ctx: CanvasRenderingContext2D,
  f: PlacedFurniture,
  t: number,
  ghost: boolean,
  spin = 0,
  joins?: { l: boolean; r: boolean },
): void {
  const def = FURNITURE[f.id];
  const wx = originX(f.cx) + f.x;
  // 선반 위에 올려둔 만큼 높이 그린다
  const gy = groundY(f.cy) - (f.lift ?? 0);
  if (ghost) ctx.globalAlpha = 0.75;
  // 접지 그림자 — 이게 없으면 가구가 붕 떠 보인다
  ctx.fillStyle = 'rgba(150,110,70,0.25)';
  ctx.beginPath();
  ctx.ellipse(wx + def.w / 2, gy + 1, def.w * 0.5, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();
  def.draw(ctx, wx, gy, t, spin, joins);
  ctx.globalAlpha = 1;
}

/**
 * 같은 높이의 판이 좌/우에 붙어 있는가.
 *
 * 판단은 [floors.ts]의 planksJoin이 한다 — 바닥 그래프가 "이어졌다"고 보는
 * 것과 그림이 "이어졌다"고 보는 것이 **같은 함수**여야 한다. 따로 계산하면
 * 다리는 사라졌는데 못 지나가는(혹은 그 반대) 자리가 생긴다.
 */
export function joinsOf(hab: Habitat, self: PlacedFurniture): { l: boolean; r: boolean } {
  const me = plankOf(self);
  if (!me) return { l: false, r: false };
  let l = false;
  let r = false;
  for (const other of hab.furniture) {
    if (other === self) continue;
    const p = plankOf(other);
    if (!p) continue;
    if (planksJoin(p, me)) l = true;
    if (planksJoin(me, p)) r = true;
  }
  return { l, r };
}

/** 밥그릇에 담긴 먹이 */
export function drawBowlFood(
  ctx: CanvasRenderingContext2D,
  hab: Habitat,
  food: FoodId | null,
): void {
  if (!food) return;
  const bowl = hab.affordAll('eat')[0];
  if (!bowl) return;
  /**
   * ★ spotX는 이미 월드 좌표다 (originX + f.x + anchor).
   *
   * 여기서 originX를 한 번 더 더하고 있었다. 밥그릇이 0번 칸에 있으면
   * 0을 더하는 셈이라 멀쩡해 보인다. 그런데 칸을 옮기는 순간 칸 번호 ×
   * 52픽셀만큼 먹이가 날아간다. 오른쪽 칸으로 옮기면 사육장 밖에 담긴다.
   *
   * 햄스터는 spotX를 그대로 써서 진짜 그릇 앞으로 걸어갔다. 그래서
   * '밥은 저기 떠 있는데 얘는 여기서 먹는' 그림이 됐다.
   *
   * spotX를 쓰는 다른 여섯 곳은 전부 맞게 쓰고 있었다. 여기만 틀렸다.
   */
  FOODS[food].draw(ctx, hab.spotX(bowl), groundY(bowl.cy) - 8, 0.85);
}

/**
 * 햄스터의 창고 — 구석에 쌓인 먹이 더미.
 * 그녀가 놓은 게 아니라 햄스터가 옮겨다 놓은 것이라, 이 게임에서 유일하게
 * '내가 만들지 않았는데 내 것 같은' 광경이다.
 */
export function drawStash(ctx: CanvasRenderingContext2D, hab: Habitat): void {
  const cell = hab.stashCell;
  if (!cell || !hab.has(cell)) return;
  const total = hab.stashTotal();
  if (total <= 0) return;

  const baseX = originX(cell.cx) + 118;
  const gy = groundY(cell.cy);
  const foods = Object.entries(hab.stash).filter(([, n]) => n > 0);

  let i = 0;
  for (const [food, n] of foods) {
    const count = Math.min(n, 6);
    for (let k = 0; k < count; k++) {
      const col = (i + k) % 4;
      const row = Math.floor((i + k) / 4);
      FOODS[food as FoodId]?.draw(
        ctx,
        baseX + col * 6 - row * 2,
        gy - 3 - row * 5,
        0.62,
      );
    }
    i += count;
    if (i > 14) break;
  }
}

/** 책상 선반의 아이콘 */
export function drawShelfIcon(
  ctx: CanvasRenderingContext2D,
  id: FurnitureId,
  cx: number,
  cy: number,
  hover: boolean,
): void {
  const def = FURNITURE[id];
  const s = Math.min(1, 18 / Math.max(def.w, def.h));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.globalAlpha = hover ? 1 : 0.82;
  def.draw(ctx, -def.w / 2, def.h / 2, 0);
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** 가구가 놓인 월드 사각형 (집기 판정용) */
export function furnitureRect(f: PlacedFurniture): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const def = FURNITURE[f.id];
  return {
    x: originX(f.cx) + f.x,
    y: groundY(f.cy) - (f.lift ?? 0) - def.h - 4,
    w: def.w,
    h: def.h + 7,
  };
}

/**
 * 이 지점이 어느 칸인가 — 가구를 놓을 수 있는 칸만 돌려준다.
 * 방이 세로로 여러 칸이 되면서 '위쪽 칸'이 생겼는데, 거긴 발 딛을 데가 아니라서
 * 가구도 못 놓는다. 그래서 세로로는 그 줄의 바닥 칸으로 끌어내린다.
 */
export function cellOfPoint(hab: Habitat, wx: number, wy: number): Cell | null {
  for (const m of hab.modules) {
    const ox = originX(m.cx);
    const oy = originY(m.cy);
    if (wx < ox || wx >= ox + MODULE_W || wy < oy || wy >= oy + MODULE_H) continue;
    let cy = m.cy;
    while (hab.has({ cx: m.cx, cy: cy + 1 })) cy++;
    return { cx: m.cx, cy };
  }
  return null;
}
