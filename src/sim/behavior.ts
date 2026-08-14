import { FURNITURE, type Affordance } from '../content/furniture';
import { clamp, damp } from '../core/math';
import { floorById, floorOfFurniture, reachableFrom, type FloorId } from './floors';
import { appetiteFor } from './prefs';
import { beginTravel, pursue, updateTravel } from './travel';
import type { ActionId, Hamster, WorldCtx } from './types';

/**
 * 유틸리티 기반 행동 선택 + 커밋(commitment).
 *
 * 커밋이 핵심이다. 매 틱 마음이 바뀌는 AI는 즉시 '고장난 것'처럼 보인다.
 * 한 번 고른 행동은 지속시간이 끝날 때까지 수행하고, 끝나야 다시 고민한다.
 */

interface ActionDef {
  id: ActionId;
  score(h: Hamster, ctx: WorldCtx): number;
  dur(ctx: WorldCtx): number;
  enter?(h: Hamster, ctx: WorldCtx): void;
}

const DEFS: readonly ActionDef[] = [
  {
    id: 'idle',
    score: () => 0.32,
    dur: (c) => c.rng.range(1.4, 3.8),
  },
  {
    id: 'wander',
    score: (h) => 0.25 + h.curiosity * 0.95 - h.attention * 0.3,
    dur: (c) => c.rng.range(2.0, 4.5),
    enter: (h, c) => {
      h.moveTarget =
        h.shy > 0
          ? clamp(c.bed.x + c.rng.range(-30, 10), h.floorX0, h.floorX1)
          : c.rng.range(h.floorX0, h.floorX1);
    },
  },
  {
    id: 'sniff',
    score: (h) => 0.2 + h.curiosity * 0.7,
    dur: (c) => c.rng.range(1.1, 2.4),
  },
  {
    id: 'groom',
    score: (h) => 0.3 + h.comfort * 0.55,
    dur: (c) => c.rng.range(2.6, 5.2),
  },
  /**
   * ★ 서서 올려다보기.
   *
   * 고개만 젖혀서 위를 보는 건 한계가 있다 — 목이 짧으니까. 실제로 햄스터는
   * 위쪽에 뭔가 있으면 **두 발로 일어선다.** 그래서 커서가 머리보다 한참
   * 위에 있으면 이 행동의 점수를 올린다. 그러면 '올려다본다'가 고개 각도가
   * 아니라 몸 전체로 표현되고, 그 편이 훨씬 잘 읽힌다.
   */
  {
    id: 'standLook',
    score: (h, c) => {
      if (!c.present) return 0.02;
      const above = clamp((h.wy - 26 - c.worldPointer.y) / 40, 0, 1);
      return 0.15 + h.attention * 1.15 + above * h.attention * 0.7;
    },
    dur: (c) => c.rng.range(1.4, 3.0),
  },
  {
    id: 'burrow',
    /**
     * ★ 점수를 올렸다.
     *
     * 0.2 기준일 때는 80초를 돌려도 한 번도 안 뽑혔다. explore(최대 1.3)와
     * useSpot(1.05)한테 계속 졌기 때문이다. 그런데 굴 파기는 햄스터가 하는
     * 짓 중에 제일 햄스터다운 짓이고, 이제는 굴이라는 남는 결과물까지 있다.
     * 선반에 올라가 보는 것보다 자주 나오는 게 맞다.
     *
     * 선반 위에서는 0이다 — 파낼 톱밥이 없다.
     */
    score: (h, c) =>
      floorById(c.graph, h.floorId)?.kind !== 'ground'
        ? 0
        : 0.55 + h.curiosity * 0.55 + (1 - h.attention) * 0.3,
    // 자리까지 걸어가서 파고 들어가는 데까지 시간이 든다. 짧으면 파다 만다.
    dur: (c) => c.rng.range(5.5, 9.5),
    enter: (h, c) => {
      // 이번 판에 팔 굴을 정해서 들고 간다. 매 틱 다시 고르면 걸어가는
      // 도중에 목표가 바뀌어서 두 구멍 사이를 왔다갔다 하게 된다.
      h.burrowX = c.hab.pickBurrow(h.floorX0, h.floorX1, c.now, (a, b) => c.rng.range(a, b)).x;
    },
  },
  {
    id: 'zoomie',
    score: (h) => (h.energy > 0.6 ? 0.09 * h.energy : 0),
    dur: (c) => c.rng.range(2.4, 4.2),
    enter: (h, c) => {
      h.moveTarget = c.rng.chance(0.5) ? h.floorX0 : h.floorX1;
      c.emit('hamster.rare', { what: 'zoomie' });
      if (!h.isVisitor) c.hab.noteBehavior('zoomie', c.now);
    },
  },

  /**
   * ★ 늘어지기.
   *
   * 몸을 바닥에 쫙 펴고 뻗는 자세. 이 게임에서 제일 값진 광경이고,
   * 그래서 **돈으로 못 산다.** 조건이 셋 다 맞아야 나온다:
   *
   *   1. comfort — 지금 편안한가 (세수하고 쓰다듬어 준 뒤)
   *   2. familiarity — 이 사람을 아는가 (세션 두어 번은 지나야 시작된다)
   *   3. present — 지금 보고 있는가 (안 볼 땐 잘 안 한다)
   *
   * 실제 햄스터가 이러는 건 완전히 안전하다고 판단했을 때뿐이다. 그러니
   * 이건 스탯이 오른 게 아니라 **신뢰를 받은 것**이고, 처음 봤을 때 화면을
   * 찍어두고 싶어지는 종류의 장면이다. 낯가리는 중이거나 손님이면 절대 안 한다 —
   * 남의 집에서 배를 깔고 눕는 햄스터는 없다.
   *
   * 오래 끈다(9~18초). 짧으면 자세가 아니라 동작이 되고, 오래 있어야 들여다볼
   * 시간이 생긴다.
   *
   * ★ energy는 쓰면 안 된다 — 이걸로 한 번 틀렸다.
   *   '놀아서 지쳤나'로 쓰려고 했는데 energy는 초당 0.00006씩 닳는 **수면
   *   시계**라 한 세션 안에서는 거의 안 움직인다. 그 항을 곱했더니 점수가
   *   영구히 0.35배로 눌려서 150초를 돌려도 한 번도 안 나왔다.
   *
   * 대신 comfort가 알아서 끝을 낸다. 늘어져 있는 동안 comfort는 계속 닳고
   * (flop은 settling이 아니다), 0.75 아래로 떨어지면 조건이 풀린다.
   * ★ attention을 억제 요소로 쓰면 안 된다 — 이걸로 두 번째로 틀렸다.
   *   '신경이 곤두서 있으면 안 늘어진다'가 그럴듯해서 넣었는데, attention은
   *   그녀가 보고 있을 때 올라가는 값이다. **보고 있을 때 늘어지는 게 이
   *   자세의 요점인데** 그 조건을 스스로 막아버린 셈이었다. 경계심은 이미
   *   shy와 comfort가 담고 있다.
   *
   * 결과적으로 남는 규칙은 하나다 — **쓰다듬어 주면 늘어진다.**
   * comfort가 오르는 길이 사실상 쓰다듬기뿐이고(세수는 점수 경쟁에서 거의
   * 못 이긴다), 늘어진 동안 comfort는 계속 닳으니 한 번 뻗고 나면 다시
   * 쓰다듬어 줘야 한다. 규칙이 하나라서 알아채기 쉽고, 알아채면 하게 된다.
   */
  {
    id: 'flop',
    score: (h, c) => {
      if (h.isVisitor || h.shy > 0) return 0;
      const safe = clamp((h.comfort - 0.75) / 0.25, 0, 1);
      const known = clamp((c.familiarity - 0.15) / 0.3, 0, 1);
      return safe * known * (c.present ? 1.7 : 0.35);
    },
    dur: (c) => c.rng.range(9, 18),
    enter: (_h, c) => {
      c.sound('settle');
    },
  },

  // ── 벽 긁기 ─────────────────────────────────────
  // 답답하면 유리를 긁는다. 방을 넓혀주진 못하지만, 알아채는 건 그녀 몫이다.
  {
    id: 'wallScratch',
    score: (h) => 0.3 + (1 - h.comfort) * 0.5,
    dur: (c) => c.rng.range(2.4, 4.0),
    enter: (h, c) => {
      h.moveTarget = c.rng.chance(0.5) ? h.floorX0 : h.floorX1;
    },
  },

  // ── 다른 바닥으로 가본다 ────────────────────────
  // 방이 하나라서 이건 선반이 있을 때만 나온다 — 사다리를 타고 올라간다.
  {
    id: 'explore',
    score: (h, c) => (otherFloor(h, c) !== null ? 0.6 + h.curiosity * 0.7 : 0),
    dur: (c) => c.rng.range(9, 18),
    enter: (h, c) => {
      const to = otherFloor(h, c);
      if (to === null) return;
      const f = floorById(c.graph, to);
      if (!f) return;
      beginTravel(h, c.graph, to, c.rng.range(f.x0, f.x1));
    },
  },

  // ── 손님에게 다가간다 / 피한다 ──────────────────
  {
    id: 'greet',
    score: (h, c) => (nearestGuest(h, c) && guestFeeling(h, c) > 0.15 ? 1.1 : 0),
    dur: (c) => c.rng.range(8, 15),
    enter: (h, c) => {
      const g = nearestGuest(h, c);
      if (!g) return;
      h.spotPhase = 0;
      h.goal = { floorId: g.floorId, x: g.wx };
    },
  },
  {
    id: 'avoid',
    score: (h, c) => (nearestGuest(h, c) && guestFeeling(h, c) < -0.1 ? 1.2 : 0),
    dur: (c) => c.rng.range(6, 12),
    enter: (h, c) => {
      const g = nearestGuest(h, c);
      if (!g) return;
      h.spotPhase = 0;
      const away = c.graph.floors.find((f) => f.id !== g.floorId);
      h.goal = away
        ? { floorId: away.id, x: c.rng.range(away.x0, away.x1) }
        : { floorId: h.floorId, x: g.wx > (h.floorX0 + h.floorX1) / 2 ? h.floorX0 : h.floorX1 };
    },
  },

  // ── 창고에 먹이를 옮긴다 ────────────────────────
  {
    id: 'stash',
    score: (h, c) => (h.carrying && stashFloor(c) !== null ? 3.0 : 0),
    dur: (c) => c.rng.range(14, 22),
    enter: (h, c) => {
      const to = stashFloor(c);
      if (to === null) return;
      const f = floorById(c.graph, to);
      if (!f) return;
      h.spotPhase = 0;
      h.goal = { floorId: to, x: f.x1 - 14 };
    },
  },

  // ── 가구를 쓰러 간다 ────────────────────────────
  {
    id: 'useSpot',
    score: (h, c) => (pickSpot(h, c) ? 0.55 + h.curiosity * 0.5 : 0),
    dur: (c) => c.rng.range(7, 14),
    enter: (h, c) => {
      const pick = pickSpot(h, c);
      if (!pick) return;
      const f = c.hab.furniture[pick.index]!;
      const fl = floorOfFurniture(c.graph, f);
      if (!fl) return;
      h.spotIndex = pick.index;
      h.spotAff = pick.aff;
      h.spotPhase = 0;
      h.goal = { floorId: fl.id, x: c.hab.spotX(f) };
    },
  },

  // ── 밥그릇에 뭔가 있다 ──────────────────────────
  {
    id: 'eat',
    score: (h, c) => (c.hab.bowlFood && !h.asleep ? 1.4 + h.hunger * 1.2 : 0),
    dur: (c) => c.rng.range(9, 13),
    enter: (h, c) => {
      const bowl = c.hab.affordAll('eat')[0];
      h.spotPhase = 0;
      if (!bowl) return;
      const fl = floorOfFurniture(c.graph, bowl);
      if (fl) h.goal = { floorId: fl.id, x: c.hab.spotX(bowl) };
    },
  },
];

/** 사다리로 갈 수 있는 다른 바닥 */
function otherFloor(h: Hamster, c: WorldCtx): FloorId | null {
  const ids = reachableFrom(c.graph, h.floorId);
  const reachable = c.graph.floors.filter(
    (f) =>
      f.id !== h.floorId &&
      ids.has(f.id),
  );
  return reachable.length > 0 ? c.rng.pick(reachable).id : null;
}

function stashFloor(c: WorldCtx): FloorId | null {
  const cell = c.hab.ensureStashCell();
  if (!cell) return null;
  const f = c.graph.floors.find(
    (fl) => fl.kind === 'ground' && fl.cells.some((x) => x.cx === cell.cx && x.cy === cell.cy),
  );
  return f?.id ?? null;
}

/** 제일 가까운 손님. 손님끼리는 서로 신경 쓰지 않는다. */
function nearestGuest(h: Hamster, c: WorldCtx): Hamster | null {
  if (h.isVisitor) return null;
  let best: Hamster | null = null;
  let bestD = Infinity;
  for (const g of c.visitors) {
    const d = Math.hypot(g.wx - h.wx, g.wy - h.wy);
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  return best;
}

function guestFeeling(h: Hamster, c: WorldCtx): number {
  const g = nearestGuest(h, c);
  return g ? c.guestFeeling(g.breed) : 0;
}

/** 지금 기분에 맞는 가구를 고른다. 다른 바닥에 있어도 고른다 — 그래서 이동이 생긴다. */
function pickSpot(h: Hamster, c: WorldCtx): { index: number; aff: Affordance } | null {
  const want: [Affordance, number][] = [
    ['run', h.energy * 1.2],
    ['hide', (1 - h.attention) * 0.7],
    ['climb', h.curiosity * 0.8],
    ['nibble', h.curiosity * 0.7],
  ];

  let best: { index: number; aff: Affordance } | null = null;
  let bestScore = 0.25;

  c.hab.furniture.forEach((p, index) => {
    if (p.id === 'bowl') return;
    const fl = floorOfFurniture(c.graph, p);
    if (!fl) return;
    // 멀리 있는 건 조금 덜 끌린다 (가기 귀찮으니까)
    const far = fl.id === h.floorId ? 1 : 0.75;
    for (const [aff, base] of want) {
      if (!FURNITURE[p.id].affords.includes(aff)) continue;
      const fav = c.prefs.favoriteSpot === p.id ? 1.5 : 1;
      const s = base * fav * far * c.rng.range(0.7, 1.3);
      if (s > bestScore) {
        bestScore = s;
        best = { index, aff };
      }
    }
  });
  return best;
}

const byId = new Map(DEFS.map((d) => [d.id, d]));

export function beginAction(h: Hamster, ctx: WorldCtx, id: ActionId, dur?: number): void {
  const def = byId.get(id);
  h.action = id;
  h.actionT = 0;
  h.actionDur = dur ?? def?.dur(ctx) ?? 2;
  h.moveTarget = null;
  h.goal = null;
  def?.enter?.(h, ctx);
}

export function chooseAction(h: Hamster, ctx: WorldCtx): void {
  let best: ActionDef | null = null;
  let bestScore = -Infinity;

  for (const def of DEFS) {
    if (def.id === h.action) continue;
    const s = def.score(h, ctx) * ctx.rng.range(0.65, 1.35);
    if (s > bestScore) {
      bestScore = s;
      best = def;
    }
  }
  beginAction(h, ctx, best?.id ?? 'idle');
}

export function updateAction(h: Hamster, ctx: WorldCtx): void {
  const { dt } = ctx;
  h.actionT += dt;

  // 관·사다리를 지나는 중이면 다른 건 아무것도 안 한다
  if (h.travel) {
    updateTravel(h, ctx);
    return;
  }

  switch (h.action) {
    case 'idle':
      h.standTarget = 0;
      break;

    case 'wander':
    case 'explore':
      h.standTarget = 0;
      locomote(h, ctx, 26);
      break;

    case 'sniff':
      h.standTarget = 0;
      h.noseWiggle = 1;
      h.headPitch = damp(h.headPitch, 0.55, 0.12, dt);
      if (ctx.rng.chance(dt * 1.6)) ctx.sound('sniff');
      break;

    case 'groom':
      h.standTarget = 0.18;
      h.groomPhase += dt * 9;
      if (ctx.rng.chance(dt * 2.2)) ctx.sound('groom');
      break;

    case 'standLook':
      h.standTarget = 1;
      h.headPitch = damp(h.headPitch, -0.2, 0.15, dt);
      break;

    /**
     * ★ 굴 파기 — 자리로 가서, 파고, 들어간다.
     *
     * 예전엔 그 자리에서 고개만 숙이는 포즈였다. 톱밥이 13px이라 들어갈
     * 데가 없었으니 그럴 수밖에 없었다. 26px이 되면서 진짜로 파고들 수 있다.
     *
     * 굴은 하나다. 이미 있으면 거기로 가고, 없으면 지금 자리에 만든다.
     * 파는 동안 고개를 처박고 앞발을 놀린다(groomPhase를 재사용한다 —
     * 세수와 파기는 앞발을 빠르게 움직이는 같은 동작이다).
     */
    case 'burrow': {
      h.standTarget = 0;
      const b = ctx.hab.burrowNear(h.burrowX ?? h.wx, ctx.now, 16);
      if (!b) break; // 고른 굴이 사라졌다 — 다음 결정에서 다시 고른다
      if (Math.abs(h.wx - b.x) > 2.5) {
        // 아직 굴 자리가 아니다 — 걸어간다
        h.digTarget = 0;
        h.moveTarget = b.x;
        locomote(h, ctx, 26);
        break;
      }
      h.moveTarget = null;
      h.headPitch = damp(h.headPitch, 0.8, 0.12, dt);
      h.groomPhase += dt * 13;
      // 판 깊이만큼만 들어갈 수 있다. 아직 얕으면 머리만 처박는 꼴이 된다.
      h.digTarget = ctx.hab.digBurrow(b, dt, ctx.now);
      if (ctx.rng.chance(dt * 2.2)) ctx.sound('rustle', 0.5);
      break;
    }

    case 'wallScratch':
      h.standTarget = 0.85;
      locomote(h, ctx, 26);
      if (h.moveTarget === null) {
        h.groomPhase += dt * 12;
        if (ctx.rng.chance(dt * 2.4)) ctx.sound('groom', 0.6);
      }
      break;

    case 'zoomie':
      h.standTarget = 0;
      locomote(h, ctx, 68);
      if (h.moveTarget === null) {
        h.moveTarget = h.wx < (h.floorX0 + h.floorX1) / 2 ? h.floorX1 : h.floorX0;
      }
      break;

    case 'greet':
      if (h.spotPhase === 0) {
        if (pursue(h, ctx)) {
          h.spotPhase = 1;
          ctx.emit('visitor.greeted');
          ctx.sound('squeak', 0.6);
        } else locomote(h, ctx, 28);
        break;
      }
      h.standTarget = 0.5;
      h.attention = Math.max(h.attention, 0.4);
      if (ctx.rng.chance(dt * 0.8)) ctx.sound('sniff', 0.7);
      break;

    case 'avoid':
      if (h.spotPhase === 0) {
        if (pursue(h, ctx)) h.spotPhase = 1;
        else locomote(h, ctx, 32);
        break;
      }
      h.standTarget = 0;
      h.curl = damp(h.curl, 0.4, 0.3, dt);
      break;

    case 'stash':
      if (h.spotPhase === 0) {
        if (pursue(h, ctx)) {
          h.spotPhase = 1;
          if (h.carrying) {
            ctx.hab.addToStash(h.carrying);
            ctx.emit('food.stashed', { food: h.carrying, total: ctx.hab.stashTotal() });
            h.carrying = null;
          }
          h.cheek = 0;
        } else locomote(h, ctx, 30);
        break;
      }
      h.standTarget = 0.15;
      h.headPitch = damp(h.headPitch, 0.6, 0.15, dt);
      h.groomPhase += dt * 6;
      if (ctx.rng.chance(dt * 1.6)) ctx.sound('rustle', 0.5);
      break;

    case 'useSpot': {
      const p = ctx.hab.furniture[h.spotIndex];
      if (!p) break;
      if (h.spotPhase === 0) {
        if (pursue(h, ctx)) {
          h.spotPhase = 1;
          ctx.emit('furniture.used', { id: p.id, action: h.spotAff ?? 'sit' });
        } else locomote(h, ctx, 28);
        break;
      }
      if (h.spotAff === 'run') {
        // 달리는 자세는 renderer가 run/runPhase로 그린다
        h.standTarget = 0;
        h.runTarget = 1;
        h.breath += dt * 5;
        if (ctx.rng.chance(dt * 6)) ctx.sound('step', 0.3);
      } else if (h.spotAff === 'hide' && FURNITURE[p.id].tube) {
        /**
         * ★ 관은 숨는 데가 아니라 지나가는 데다.
         *
         * 웅크리고 있으면 그냥 가려진 햄스터지만, 한쪽으로 들어가 반대쪽으로
         * 나오면 **사라졌다가 나타난다.** 관을 걷어내면서 잃었던 박자가
         * 이 몇 초에 들어 있다. 그래서 숨기지 않고 통과시킨다.
         *
         * 끝에 닿으면 반대쪽을 새 목표로 잡는다 — 왕복하다가 시간이 되면
         * 하던 일로 돌아간다. 천천히 걷는다(18). 관 속은 좁으니까.
         */
        const tube = FURNITURE[p.id].tube!;
        const left = ctx.hab.furnitureX(p) + tube.x0;
        const right = ctx.hab.furnitureX(p) + tube.x1;
        // 관 천장이 낮다 — 몸을 낮춰야 안에 들어간다
        h.standTarget = 0;
        h.curl = damp(h.curl, 0.65, 0.25, dt);
        if (h.moveTarget === null || Math.abs(h.wx - h.moveTarget) < 2) {
          h.moveTarget = Math.abs(h.wx - left) < Math.abs(h.wx - right) ? right : left;
        }
        locomote(h, ctx, 18);
        if (ctx.rng.chance(dt * 2)) ctx.sound('rustle', 0.35);
      } else if (h.spotAff === 'hide') {
        h.standTarget = 0;
        h.curl = damp(h.curl, 0.45, 0.3, dt);
      } else if (h.spotAff === 'climb') {
        h.standTarget = 1;
      } else if (h.spotAff === 'drink') {
        /**
         * 물 마시기 — 두 발로 서서 고개를 든다.
         *
         * 급수기 꼭지는 위에 달려 있어서 실제로 이 자세가 나온다. 다른
         * 가구는 다 엎드려 쓰는데 이것만 서서 쓰니까, 멀리서 실루엣만 봐도
         * "아 물 마시네"가 읽힌다. 자세 하나가 아이콘 노릇을 한다.
         */
        h.standTarget = 1;
        h.headPitch = damp(h.headPitch, -0.5, 0.14, dt);
        h.noseWiggle = 1;
        if (ctx.rng.chance(dt * 2.6)) ctx.sound('sniff', 0.5);
      } else {
        h.standTarget = 0.2;
        h.groomPhase += dt * 7;
        if (ctx.rng.chance(dt * 1.5)) ctx.sound('groom', 0.7);
      }
      break;
    }

    case 'eat':
      if (h.spotPhase === 0) {
        h.noseWiggle = 1;
        if (pursue(h, ctx)) {
          h.spotPhase = 1;
          decideMeal(h, ctx);
        } else locomote(h, ctx, 32);
        break;
      }
      h.standTarget = 0.1;
      h.groomPhase += dt * 8;
      h.cheek = Math.min(1, h.cheek + dt * 0.5);
      if (ctx.rng.chance(dt * 3)) ctx.sound('groom', 0.9);
      break;

    case 'approach':
      h.standTarget = 0;
      if (h.goal) {
        if (!pursue(h, ctx)) locomote(h, ctx, 30);
      } else {
        locomote(h, ctx, 34);
      }
      break;

    case 'stretch':
      h.standTarget = 0.35;
      break;

    case 'sleep':
      h.standTarget = 0;
      break;

    case 'flop':
      h.standTarget = 0;
      h.flatTarget = 1;
      break;
  }

  // 이 자세를 요구하는 행동은 하나뿐이다. 나머지는 전부 풀린다.
  if (h.action !== 'flop') h.flatTarget = 0;
  if (h.action !== 'useSpot' || h.spotAff !== 'run' || h.spotPhase !== 1) h.runTarget = 0;

  /**
   * 고개는 기본적으로 제자리로 돌아온다. 다만 **고개 각도가 곧 동작인** 것들은
   * 빼야 한다 — 안 빼면 위에서 각도를 준 그 틱에 여기서 도로 지운다.
   * 물 마시기(고개를 든다)가 실제로 그래서 안 나왔다.
   */
  const pitchIsThePose =
    h.action === 'sniff' ||
    h.action === 'burrow' ||
    h.action === 'eat' ||
    (h.action === 'useSpot' && h.spotPhase === 1 && h.spotAff === 'drink');
  if (!pitchIsThePose) h.headPitch = damp(h.headPitch, 0, 0.2, dt);
  if (
    h.action !== 'groom' &&
    h.action !== 'eat' &&
    h.action !== 'useSpot' &&
    h.action !== 'wallScratch' &&
    h.action !== 'stash'
  ) {
    h.groomPhase = 0;
  }
  if (h.action !== 'eat') h.cheek = damp(h.cheek, 0, 0.9, dt);
}

/**
 * 밥그릇 앞에 도착했다. 먹을까 말까.
 * 어떤 음식도 확률 0이 아니다 — 절대 안 먹는 음식이 있으면 그건 성격이 아니라 벽이다.
 */
function decideMeal(h: Hamster, ctx: WorldCtx): void {
  const food = ctx.hab.bowlFood;
  if (!food) {
    h.action = 'idle';
    return;
  }

  const p = appetiteFor(ctx.prefs, food, h.hunger);
  if (ctx.rng.chance(p)) {
    ctx.hab.bowlFood = null;
    h.hunger = Math.max(0, h.hunger - 0.6);
    h.comfort = Math.min(1, h.comfort + 0.2);
    h.carrying = food; // 볼에 넣고 창고로 가져간다
    ctx.emit('food.eaten', { food, season: ctx.season, weather: ctx.weather });
    if (ctx.prefs.favoriteFood === food) {
      ctx.sound('squeak', 1);
      h.attention = 1;
    }
  } else {
    ctx.emit('food.ignored', { food });
    h.actionDur = h.actionT + 0.6;
    h.spotPhase = 1;
    h.cheek = 0;
  }
}

export function actionFinished(h: Hamster): boolean {
  return h.actionT >= h.actionDur;
}

/**
 * 버스트-정지 이동.
 * 부드러운 보간(lerp) 금지. 햄스터는 '탁 튀어나갔다 탁 멈춘다'.
 * 이 리듬 하나가 '귀엽다'는 감각의 대부분을 만든다.
 */
export function locomote(h: Hamster, ctx: WorldCtx, speed: number): void {
  const { dt } = ctx;
  if (h.moveTarget === null) {
    h.vx = 0;
    return;
  }

  const dx = h.moveTarget - h.wx;
  if (Math.abs(dx) < 3) {
    if (h.vx !== 0) {
      h.landSquash = 1;
      ctx.sound('rustle', 0.7);
    }
    h.vx = 0;
    h.burst = 0;
    h.moveTarget = null;
    return;
  }

  if (h.burst > 0) {
    h.burst -= dt;
    h.facing = dx > 0 ? 1 : -1;
    h.vx = h.facing * speed;
    if (h.burst <= 0) {
      h.vx = 0;
      h.landSquash = 1;
      h.burstPause = ctx.rng.range(0.1, 0.42);
      ctx.sound('rustle', 0.55);
    }
  } else if (h.burstPause > 0) {
    h.burstPause -= dt;
    h.vx = 0;
  } else {
    h.burst = ctx.rng.range(0.18, 0.52);
    ctx.sound('step', speed > 50 ? 1 : 0.75);
  }

  h.wx = clamp(h.wx + h.vx * dt, h.floorX0, h.floorX1);
}
