import type { BreedId } from '../content/breeds';
import { clamp, damp, lerp, spring } from '../core/math';
import type { Rng } from '../core/rng';
import { actionFinished, beginAction, chooseAction, updateAction } from './behavior';
import { floorAt, floorById, type Floor, type FloorId } from './floors';
import { updateNotice } from './notice';
import { wakefulness } from './schedule';
import { weatherMood } from './season';
import { worldPos } from './travel';
import type { Hamster, WorldCtx } from './types';
import { BURROW_MAX } from '../world';

export function createHamster(
  now: number,
  rng: Rng,
  firstEver = false,
  visitor?: { breed: BreedId; leaveAt: number; floorId: FloorId; x: number; y: number },
): Hamster {
  const w = wakefulness(now);
  // 첫 만남만은 반드시 깨어 있다. 처음 켰는데 자고 있으면 만남 자체가 없다.
  const asleep = firstEver ? false : w < 0.25;
  const startX = visitor?.x ?? 76;
  const startY = visitor?.y ?? 68;

  return {
    breed: visitor?.breed ?? 'golden',
    isVisitor: visitor !== undefined,
    leaveAt: visitor?.leaveAt ?? Infinity,

    floorId: visitor?.floorId ?? '',
    wx: startX,
    floorY: startY,
    floorX0: startX - 40,
    floorX1: startX + 40,
    wy: startY,
    vx: 0,
    facing: rng.chance(0.5) ? 1 : -1,
    moveTarget: null,
    travel: null,
    goal: null,
    burst: 0,
    burstPause: 0,
    landSquash: 0,
    held: false,
    heldT: 0,
    falling: false,
    fallVy: 0,
    flail: 0,

    energy: asleep ? 0.4 : 0.85,
    curiosity: 0.5,
    comfort: 0.5,
    attention: 0,

    asleep: visitor ? false : asleep, // 손님은 남의 집에서 안 잔다
    sleepPressure: asleep && !visitor ? 1 : 0,

    headYaw: 1.15,
    headYawVel: 0,
    headPitch: 0,
    stand: 0,
    standTarget: 0,
    standVel: 0,
    curl: asleep ? 1 : 0,
    flat: 0,
    flatTarget: 0,
    dig: 0,
    digTarget: 0,
    burrowX: null,
    run: 0,
    runTarget: 0,
    runPhase: 0,
    breath: rng.range(0, 10),
    earPerk: 0.3,
    earTwitch: 0,
    earTwitchVel: 0,
    cheek: 0,
    eyeOpenBase: asleep ? 0 : 1,
    eyeOpen: asleep ? 0 : 1,
    blinkIn: rng.range(1, 5),
    noseWiggle: 0,
    groomPhase: 0,

    action: asleep ? 'sleep' : 'idle',
    actionT: 0,
    actionDur: 2,

    spotIndex: -1,
    spotAff: null,
    spotPhase: 0,
    hunger: 0.4,
    carrying: null,

    notice: 'none',
    noticeT: 0,
    noticeDur: 0,
    noticeCooldown: 0,

    petting: false,
    petBout: 0,
    petContact: 0,
    petJudged: false,
    petPoke: 0,
    petRefuseFor: 0,
    flinch: 0,
    refuseLook: 0,
    refuseAwayX: 0,
    shy: firstEver ? 150 : 0,
  };
}

export function updateHamster(h: Hamster, ctx: WorldCtx): void {
  const { dt } = ctx;

  h.breath += dt;
  if (h.shy > 0) h.shy = Math.max(0, h.shy - dt);
  h.heldT = damp(h.heldT, h.held ? 1 : 0, 0.06, dt);

  // 손에 들려 있으면 하던 일이 전부 멈춘다. 바닥도 안 본다 — 발이 안 닿으니까.
  if (h.held) {
    updateHeld(h, ctx);
    updateGaze(h, ctx);
    updatePose(h, ctx);
    return;
  }
  if (h.falling) {
    updateFall(h, ctx);
    updateGaze(h, ctx);
    updatePose(h, ctx);
    return;
  }
  h.flail = damp(h.flail, 0, 0.07, dt);

  /**
   * 서 있는 바닥을 확인한다.
   *
   * 없어졌을 때 첫 바닥으로 보내면 안 된다 — 그건 순간이동이고, 화면상으론
   * 햄스터가 공중에 떠 있거나 엉뚱한 데 나타난 걸로 보인다.
   * 바닥이 없어지는 흔한 이유는 '사라져서'가 아니라 '옆에 방을 붙여서 더 넓은
   * 바닥으로 합쳐져서'다. 그럴 땐 지금 발밑에 있는 바닥을 찾으면 된다.
   */
  /**
   * ★ 이동 중이면 목적지가 아직 있는지부터 본다.
   *
   * 이동 경로선은 출발할 때 계산한 월드 좌표를 그대로 따라간다. 그런데 그 사이에
   * 플레이어가 방이나 관을 빼면 그 선은 이제 허공을 지난다. 이때 floorId는 아직
   * '출발한 바닥'이라 멀쩡해서, 바닥이 사라졌을 때의 복구 코드가 안 걸린다.
   * 그래서 햄스터가 아무것도 없는 데를 걸어간다.
   */
  if (h.travel && !floorById(ctx.graph, h.travel.floorId)) {
    h.travel = null;
    h.goal = null;
    h.moveTarget = null;
  }

  let floor: Floor | undefined = floorById(ctx.graph, h.floorId);
  if (!floor) floor = floorAt(ctx.graph, h.wx, h.floorY) ?? undefined;
  if (!floor) {
    // 정말로 갈 데가 없다 — 제일 가까운 바닥으로 내려놓는다
    let best: Floor | null = null;
    let bestD = Infinity;
    for (const f of ctx.graph.floors) {
      const d = Math.abs(f.y - h.floorY) + Math.abs(clamp(h.wx, f.x0, f.x1) - h.wx);
      if (d < bestD) {
        bestD = d;
        best = f;
      }
    }
    floor = best ?? undefined;
  }
  if (floor && floor.id !== h.floorId) {
    h.floorId = floor.id;
    h.travel = null;
    h.goal = null;
    h.wx = clamp(h.wx, floor.x0, floor.x1);
  }
  if (floor) {
    h.floorY = floor.y;
    h.floorX0 = floor.x0;
    h.floorX1 = floor.x1;
    if (!h.travel) h.wx = clamp(h.wx, floor.x0, floor.x1);
  }

  // 손님은 남의 집에서 자지 않고, 쓰다듬을 수도 없다.
  // 만질 수 있게 하는 순간 '내 햄스터'가 특별하지 않게 된다.
  if (!h.isVisitor) {
    updateSleep(h, ctx);
    updatePetting(h, ctx);
  }

  const noticeSeized = h.isVisitor ? false : updateNotice(h, ctx);
  const refuseSeized = updateRefuseLook(h, ctx);
  if (!noticeSeized && !refuseSeized && !h.petting) {
    if (h.asleep) h.action = 'sleep';
    else {
      updateAction(h, ctx);
      if (actionFinished(h)) chooseAction(h, ctx);
    }
  }

  updateDrives(h, ctx);
  updateGaze(h, ctx);
  updatePose(h, ctx);

  const p = worldPos(h);
  // 굴에 들어간 만큼 톱밥 선 아래로 내려간다. 사다리를 타는 중엔 굴이 없다.
  h.wy = p.y + (h.travel ? 0 : h.dig * BURROW_MAX);
  if (h.travel) h.wx = p.x;
}

// ────────────────────────────────────────────────────────────
// 손에 들기 — 쓰다듬기 다음 단계.
//
// 실제로 햄스터를 손에 올려본 사람은 안다. 처음엔 버둥거리고, 익숙해지면
// 손바닥에 가만히 앉는다. 그 차이를 친밀도로 만든다.
// 다만 '거절'은 넣지 않았다. 쓰다듬기는 거절당해야 승낙이 의미를 갖지만,
// 들어올리기는 플레이어가 이동시키려고 쓰는 기능이라 안 되면 그냥 고장으로 읽힌다.
// ────────────────────────────────────────────────────────────
function updateHeld(h: Hamster, ctx: WorldCtx): void {
  const { dt } = ctx;

  h.travel = null;
  h.goal = null;
  h.moveTarget = null;
  h.vx = 0;
  h.petting = false;
  h.petContact = 0;
  h.notice = 'none';
  h.action = 'idle';
  h.curl = damp(h.curl, 0, 0.08, dt);

  // 자고 있었으면 깬다. 놀라서가 아니라 들어올려져서.
  if (h.asleep) {
    h.asleep = false;
    h.sleepPressure = 0;
    ctx.sound('wake');
    ctx.emit('hamster.woke', { by: 'player' });
  }

  /**
   * 손을 따라오되 조금 늦게. 이 지연이 '무게'다.
   * 커서에 딱 붙으면 들고 있는 게 아니라 커서에 그려진 그림이 된다.
   */
  h.wx = damp(h.wx, ctx.worldPointer.x, 0.045, dt);
  h.wy = damp(h.wy, ctx.worldPointer.y + 13, 0.045, dt);

  // 아직 안 친하면 버둥거린다. 친해질수록 가만히 있는다.
  const squirm = (1 - ctx.familiarity) * 0.8 + (h.shy > 0 ? 0.4 : 0);
  if (squirm > 0.05) {
    h.wx += Math.sin(h.breath * 11) * squirm * 1.4;
    h.wy += Math.sin(h.breath * 17 + 1) * squirm * 0.9;
    if (ctx.rng.chance(dt * squirm * 2)) h.facing = h.facing === 1 ? -1 : 1;
  }

  // 매달린 자세 — 몸을 세우지 않는다
  h.standTarget = 0;
  h.earPerk = damp(h.earPerk, 1, 0.1, dt);
}

/**
 * 높은 데서 놓으면 허둥대며 떨어진다.
 *
 * ★ 다치는 걸로 읽히면 안 된다. 이 게임은 벌이 없는 게 계약이다.
 *   그래서 중력을 실제보다 한참 약하게 잡았다 — 툭 떨어지는 게 아니라
 *   버둥거리며 천천히 내려앉는다. 느려야 귀엽고, 귀여워야 안 미안하다.
 *   착지는 항상 무사하고, 잠깐 멍하니 앉아 있다가 하던 일로 돌아간다.
 */
const GRAVITY = 210;
const TERMINAL = 96;

function updateFall(h: Hamster, ctx: WorldCtx): void {
  const { dt } = ctx;

  h.fallVy = Math.min(TERMINAL, h.fallVy + GRAVITY * dt);
  h.wy += h.fallVy * dt;

  // 떨어질수록 더 허둥댄다. 놓인 순간엔 아직 어리둥절하다.
  h.flail = damp(h.flail, 1, 0.1, dt);
  h.wx = clamp(h.wx + Math.sin(h.breath * 23) * h.flail * 1.2, h.floorX0, h.floorX1);

  // 네 발을 허공에 뻗고, 귀를 세우고, 눈을 크게 뜬다
  h.standTarget = 0.9;
  h.earPerk = 1;
  h.eyeOpenBase = 1;

  if (h.wy < h.floorY) return;

  // ── 착지 ──
  h.wy = h.floorY;
  h.falling = false;
  h.standTarget = 0;
  // 높이 떨어졌을수록 크게 눌린다. 그래도 다치지는 않는다.
  h.landSquash = clamp(0.6 + (h.fallVy / TERMINAL) * 0.7, 0, 1.4);
  h.fallVy = 0;
  ctx.sound('settle', 1);
  // 잠깐 그 자리에 앉아 정신을 차린다
  beginAction(h, ctx, 'idle', 1.4);
}

// ────────────────────────────────────────────────────────────
// 수면 — 실제 시계가 지배하고, energy는 흔들기만 한다.
// 실제 햄스터는 시계 생물이다. 그리고 이 게임은 절대 배고파서 깨우지 않는다.
// ────────────────────────────────────────────────────────────
function updateSleep(h: Hamster, ctx: WorldCtx): void {
  const { dt } = ctx;
  const w = wakefulness(ctx.now, ctx.wakeCurve);

  if (!h.asleep) {
    h.energy = clamp(h.energy - dt * 0.00006 * (1 - weatherMood(ctx.weather).energy * 0.5), 0, 1);
    if (h.shy > 0) return; // 첫 만남 중에는 자러 가지 않는다
    if (h.carrying) return; // 볼에 먹이가 있으면 먼저 창고에 넣는다

    const sleepy = w < 0.22 && h.energy < 0.55 && !ctx.present;
    const verySleepy = w < 0.12;

    // 졸리면 잠자리로 걸어간다 — 다른 바닥이면 관을 타고 간다.
    // "자러 간다"는 행동 자체가 하루의 마침표다.
    if ((sleepy || verySleepy) && h.sleepPressure < 0.5 && ctx.rng.chance(dt * 0.25)) {
      h.sleepPressure = 1;
      beginAction(h, ctx, 'approach', 40);
      h.goal = { floorId: ctx.bed.floorId, x: ctx.bed.x };
    }

    const atBed =
      h.floorId === ctx.bed.floorId && Math.abs(h.wx - ctx.bed.x) < 16 && h.travel === null;
    if (h.sleepPressure > 0.5 && h.moveTarget === null && atBed) {
      h.asleep = true;
      h.action = 'sleep';
      h.notice = 'none';
      h.goal = null;
      ctx.sound('settle');
      ctx.emit('hamster.slept');
      // ★ 어디서 잤는지가 그 방에 대한 답안지다. 잠자리 취향은 여기서 자란다.
      const bed = nearestSleepSpot(ctx, h.wx);
      if (bed) ctx.emit('furniture.used', { id: bed, action: 'sleep' });
    }
  } else {
    h.energy = clamp(h.energy + dt * 0.00016, 0, 1);

    const clockWake = w > 0.45 && ctx.rng.chance(dt * 0.3);
    const restedWake = h.energy > 0.97 && ctx.rng.chance(dt * 0.05);
    const nudgeWake = h.petContact > 1.6;

    if (clockWake || restedWake || nudgeWake) {
      h.asleep = false;
      h.sleepPressure = 0;
      h.curl = 0.8;
      beginAction(h, ctx, 'stretch', 1.8); // 게슴츠레한 기지개. 놀라서 깨는 연출은 절대 없다.
      ctx.sound('wake');
      ctx.emit('hamster.woke', nudgeWake ? { by: 'player' } : {});
    }
  }
}

// ────────────────────────────────────────────────────────────
// 쓰다듬기 — '부드러움'이라는 기술.
// 거절할 수 있어야 승낙이 의미를 갖는다. 게이지도 숙련도도 없다.
// ────────────────────────────────────────────────────────────
function updatePetting(h: Hamster, ctx: WorldCtx): void {
  const { dt, pointer } = ctx;

  if (h.petRefuseFor > 0) h.petRefuseFor -= dt;
  if (h.petPoke > 0) h.petPoke -= dt;
  h.flinch = damp(h.flinch, 0, 0.12, dt);

  // 관 안에서는 만질 수 없다 — 플라스틱 너머니까
  const bodyY = h.wy - 11;
  const near =
    h.travel === null &&
    pointer.inside &&
    Math.hypot(ctx.worldPointer.x - h.wx, ctx.worldPointer.y - bodyY) < (h.asleep ? 15 : 20);

  if (!near) {
    if (h.petting) h.petting = false;
    h.petContact = 0;
    h.petJudged = false;
    return;
  }

  h.petContact += dt;

  // 마우스는 '가만히 0.28초', 손가락은 '톡'. 둘 다 같은 판정으로 들어간다.
  const asked = pointer.still > 0.28 || h.petPoke > 0;
  if (!h.petting && !h.petJudged && h.petRefuseFor <= 0 && !h.asleep && asked) {
    h.petJudged = true;

    // ★ 처음 몇 번은 반드시 받아준다.
    // 거절이 '성격'으로 읽히려면 "이건 통하는 행동이다"가 먼저 학습돼 있어야 한다.
    const guaranteed = ctx.petCount < 3;
    const p = clamp(0.55 + 0.3 * ctx.familiarity + 0.15 * h.attention, 0.3, 0.94);

    if (guaranteed || ctx.rng.chance(p)) {
      h.petting = true;
      h.petBout = 0;
      ctx.sound('squeak', 0.8);
      ctx.emit('pet.accepted');
    } else {
      // 거절 — 하지만 바로 돌아서지 않는다. 먼저 눈을 마주친다.
      h.petRefuseFor = ctx.rng.range(6, 15);
      h.refuseLook = 0.75;
      h.refuseAwayX = clamp(
        h.wx + (h.wx < ctx.worldPointer.x ? -34 : 34),
        h.floorX0,
        h.floorX1,
      );
      h.attention = 1;
      h.earPerk = 1;
      ctx.emit('pet.refused');
    }
  }

  if (h.petting) {
    h.petBout += dt;
    h.attention = 1;
    h.vx = 0;
    h.moveTarget = null;
    h.standTarget = 0;

    if (pointer.speed > 95) {
      // 손길이 거칠다 → 놀란다. 이건 판단이 아니라 반사라서 즉시 도망간다.
      h.flinch = 1;
      h.petting = false;
      h.petRefuseFor = ctx.rng.range(8, 18);
      beginAction(h, ctx, 'wander', 2.5);
      h.moveTarget = clamp(
        h.wx + (h.wx < ctx.worldPointer.x ? -40 : 40),
        h.floorX0,
        h.floorX1,
      );
      ctx.sound('flinch');
      ctx.emit('pet.refused', { reason: 'startled' });
    } else {
      const gentle = pointer.speed > 4 && pointer.speed < 48 ? 1 : 0.35;
      h.comfort = clamp(h.comfort + dt * 0.18 * gentle, 0, 1);
    }
  }
}

/**
 * 거절의 문법: 굳는다 → 눈을 마주친다 → 그리고 나서 돌아선다.
 * 바로 걸어가버리면 "입력이 씹혔다"로 읽힌다.
 */
function updateRefuseLook(h: Hamster, ctx: WorldCtx): boolean {
  if (h.refuseLook <= 0) return false;

  h.refuseLook -= ctx.dt;
  h.vx = 0;
  h.moveTarget = null;
  h.attention = 1;
  h.standTarget = 0.4;

  if (h.refuseLook <= 0) {
    beginAction(h, ctx, 'wander', 3);
    h.moveTarget = h.refuseAwayX;
  }
  return true;
}

function nearestSleepSpot(ctx: WorldCtx, wx: number): string | null {
  let best: string | null = null;
  let bestD = 26;
  for (const p of ctx.hab.affordAll('sleep')) {
    const d = Math.abs(ctx.hab.spotX(p) - wx);
    if (d < bestD) {
      bestD = d;
      best = p.id;
    }
  }
  return best;
}

function updateDrives(h: Hamster, ctx: WorldCtx): void {
  const { dt, pointer } = ctx;

  // 주의: 플레이어가 가까이 있고 움직이면 오른다. 아니면 천천히 식는다.
  const dist = pointer.inside ? Math.abs(ctx.worldPointer.x - h.wx) : 999;
  const closeness = clamp(1 - dist / 90, 0, 1);
  const stimulus = pointer.inside ? 0.25 + closeness * 0.9 + Math.min(pointer.speed, 40) / 90 : 0;

  if (h.asleep) h.attention = damp(h.attention, 0, 0.5, dt);
  else h.attention = clamp(h.attention + (stimulus * 0.55 - 0.22) * dt, 0, 1);

  const spending = h.action === 'wander' || h.action === 'sniff' || h.action === 'burrow';
  h.curiosity = clamp(h.curiosity + (spending ? -0.3 : 0.045) * dt, 0, 1);

  const settling = h.action === 'groom' || h.petting || h.asleep;
  const mood = weatherMood(ctx.weather);
  h.comfort = clamp(h.comfort + ((settling ? 0.1 : -0.025) + mood.comfort) * dt, 0, 1);

  h.hunger = clamp(h.hunger + dt * 0.00004, 0, 1);

  // ── 신호 ──────────────────────────────────────
  // 행동이 '끝난 순간'에만 한 번 센다. 매 틱 세면 즉시 임계값을 넘어버린다.
  if (h.actionT > 0 && h.actionT - dt <= 0 && !h.isVisitor) {
    if (h.action === 'burrow') ctx.hab.noteBehavior('burrow', ctx.now);
    if (h.action === 'wallScratch') ctx.hab.noteBehavior('wallScratch', ctx.now);
  }
}

// ────────────────────────────────────────────────────────────
// 시선 — 이 시스템에서 투자 대비 효율이 가장 높은 코드.
// 뭔가를 쳐다보는 생물은 살아있어 보이고, 나를 쳐다보는 생물은 동료로 느껴진다.
// ────────────────────────────────────────────────────────────
function updateGaze(h: Hamster, ctx: WorldCtx): void {
  const { dt, pointer } = ctx;

  const restYaw = h.facing * 1.15;
  const lookYaw = clamp((ctx.worldPointer.x - h.wx) / 90, -1, 1) * 0.55;

  const att = h.asleep || h.travel ? 0 : h.attention * (pointer.inside ? 1 : 0.3);
  const target = lerp(restYaw, lookYaw, att);

  [h.headYaw, h.headYawVel] = spring(h.headYaw, h.headYawVel, target, 110, 15, dt);

  /**
   * ★ 고개의 위아래.
   *
   * 예전엔 ±0.5에 나눗수가 60이라, 커서를 천장에 갖다 대도 고개가 겨우
   * 1.6px 움직였다. '위를 본다'가 아니라 '머리가 살짝 떴다'로 읽혔다.
   * 범위를 넓히고 더 일찍 포화시킨다 — 렌더러 쪽에서 이 값으로 눈과
   * 주둥이를 머리 구 위에서 같이 돌리기 때문에 이제 각도가 실제로 보인다.
   */
  if (!h.asleep && att > 0.2 && h.action !== 'sniff' && h.action !== 'burrow') {
    const headY = h.wy - lerp(15, 23, h.stand);
    const pitch = clamp((ctx.worldPointer.y - headY) / 42, -0.66, 0.62) * att;
    h.headPitch = damp(h.headPitch, pitch, 0.18, dt);
  }
}

function updatePose(h: Hamster, ctx: WorldCtx): void {
  const { dt } = ctx;

  // 두 발로 서기 — 스프링이라 살짝 오버슛한다. 그 오버슛이 '귀여움'이다.
  const [s, sv] = spring(h.stand, h.standVel, h.standTarget, 210, 19, dt);
  h.stand = clamp(s, 0, 1.12);
  h.standVel = sv;

  // 굴에 들어가면 몸을 만다 — 그래야 26px 톱밥 안에 실제로 들어간다.
  // 펴진 채로 내려가면 등이 톱밥 위로 삐져나온다.
  const curlWant = h.asleep ? 1 : Math.max(h.dig * 0.9, h.action === 'burrow' ? 0.3 : 0);
  h.curl = damp(h.curl, curlWant, 0.25, dt);

  /**
   * ★ 납작 — 눕는 건 느리고 일어나는 건 빠르다.
   *
   * 같은 속도로 오가면 자세가 아니라 슬라이더가 된다. 실제로 늘어지는 건
   * 마음을 놓는 과정이라 뜸을 들이고, 일어나는 건 뭔가 알아챘기 때문이라
   * 순식간이다. 이 비대칭 하나가 '결심해서 누웠다'는 인상을 만든다.
   *
   * 들려 있거나 떨어지는 중이거나 자는 중이면 무조건 풀린다 —
   * 자는 자세는 curl이 맡고, 손에 들린 채 납작할 수는 없다.
   */
  const flatWant = h.asleep || h.held || h.falling ? 0 : h.flatTarget;
  h.flat = clamp(damp(h.flat, flatWant, flatWant > h.flat ? 0.62 : 0.13, dt), 0, 1);

  /**
   * 굴로 들어가는 것도 느리고 나오는 건 빠르다. 파고드는 건 공들이는 일이고
   * 튀어나오는 건 한순간이다 — 그 대비가 '사라졌다가 나온다'의 맛이다.
   * 들려 있거나 떨어지는 중이면 당연히 풀린다.
   */
  /**
   * ★ 굴에 들어갈지는 여기서 한 곳에서만 정한다.
   *
   * 자고 있으면 updateAction이 아예 안 돌아서 행동 쪽에서 풀어줄 수가 없다.
   * 두 군데서 이 값을 만지면 '잠들었는데 굴에서 안 나온다' 같은 게 조용히
   * 생긴다. 그래서 굴 파기 행동만 값을 올리고, 나머지 판단은 전부 여기다.
   *
   * 그리고 굴에서 자는 건 덤이 아니라 핵심이다 — 낮에 들여다봤는데 굴만
   * 있고 햄스터가 안 보이면, 그게 '저 안에서 자고 있구나'가 된다.
   */
  const onGround = floorById(ctx.graph, h.floorId)?.kind === 'ground';
  const bur = onGround && !h.travel ? ctx.hab.burrowNear(h.wx, ctx.now, 7) : null;
  if (h.asleep) h.digTarget = bur ? ctx.hab.burrowDepth(bur, ctx.now) : 0;
  else if (h.action !== 'burrow') h.digTarget = 0;

  // 달리기는 러닝휠에 있을 때만. 내려오면 금방 잦아든다.
  const runWant = h.held || h.falling || h.asleep ? 0 : h.runTarget;
  h.run = clamp(damp(h.run, runWant, runWant > h.run ? 0.12 : 0.2, dt), 0, 1);
  if (h.run > 0.02) h.runPhase += dt * 15 * (0.4 + h.run * 0.6);

  const digWant = h.held || h.falling ? 0 : h.digTarget;
  h.dig = clamp(damp(h.dig, digWant, digWant > h.dig ? 0.5 : 0.11, dt), 0, 1);

  // 납작할수록 귀가 눕는다. 늘어진 햄스터는 귀부터 무너진다.
  const perkTarget = (h.asleep ? 0 : 0.25 + h.attention * 0.75) * (1 - h.flat * 0.85);
  h.earPerk = damp(h.earPerk, perkTarget, 0.14, dt);
  if (!h.asleep && ctx.rng.chance(dt * 0.4)) h.earTwitchVel += ctx.rng.range(-11, 11);
  const [et, etv] = spring(h.earTwitch, h.earTwitchVel, 0, 300, 17, dt);
  h.earTwitch = clamp(et, -0.5, 0.5);
  h.earTwitchVel = etv;

  // 늘어져 있으면 눈이 반쯤 감긴다 — 감으면 자는 거고, 반만 감아야 '녹은' 거다
  const openTarget = lerp(
    h.asleep ? 0 : h.petting ? 0.18 : h.flinch > 0.4 ? 0.5 : 1,
    0.24,
    h.flat,
  );
  h.eyeOpenBase = damp(h.eyeOpenBase, openTarget, 0.07, dt);

  let blinkF = 1;
  h.blinkIn -= dt;
  if (h.blinkIn <= 0) {
    const p = -h.blinkIn / 0.13;
    if (p >= 1) h.blinkIn = ctx.rng.range(2.0, 6.5);
    else blinkF = p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2;
  }
  h.eyeOpen = h.eyeOpenBase * blinkF;

  const noseTarget = h.asleep ? 0 : h.action === 'sniff' ? 1 : h.attention * 0.5;
  h.noseWiggle = damp(h.noseWiggle, noseTarget, 0.12, dt);

  // 볼주머니: 먹이를 물고 있으면 계속 부풀어 있다
  if (h.carrying) h.cheek = damp(h.cheek, 1, 0.25, dt);

  h.landSquash = damp(h.landSquash, 0, 0.06, dt);
  h.earPerk = clamp(h.earPerk, 0, 1);
}
