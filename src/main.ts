import { Sfx } from './audio/sfx';
import { FOOD_IDS } from './content/foods';
import { FURNITURE, FURNITURE_IDS, type FurnitureId } from './content/furniture';
import { SUBSTRATE_IDS } from './content/modules';
import { EventLog } from './core/log';
import { startLoop } from './core/loop';
import { clamp, lerp } from './core/math';
import { Presence } from './core/presence';
import { createRng } from './core/rng';
import { clearDemoStorage, DEMO_MODE, resetIfAsked, TabLock } from './core/store';
import { seedDemo } from './dev/demo';
import { dayKeyOf } from './journal/facts';
import { Journal } from './journal/journal';
import {
  drawBackdrop,
  drawDeskSurface,
  lampWarmthAt,
} from './render/backdrop';
import { abovePath, burrowPath, drawBurrowHole, drawBurrowMound } from './render/burrow';
import { Camera } from './render/camera';
import {
  applyDeskScale,
  carrierRect,
  crateRect,
  drawCarrier,
  drawCrate,
  drawGift,
  drawHamsterLabel,
  drawHamsterTray,
  drawFoodLabel,
  drawFoodTray,
  drawForeground,
  drawFurnitureLabel,
  drawJar,
  drawShelfTray,
  drawSubstrateLabel,
  drawSubstrateTray,
  drawToast,
  foodTrayIndex,
  hamsterTrayIndex,
  hit,
  giftRect,
  jarRect,
  shelfTrayIndex,
  substrateTrayIndex,
  toDesk,
} from './render/desk';
import {
  cellOfPoint,
  drawBowlFood,
  drawCarried,
  drawDropGhost,
  drawFurniture,
  drawFurnitureFront,
  drawStash,
  furnitureRect,
} from './render/furniture';
import { drawHamster } from './render/hamster';
import { drawHabitatBack, drawHabitatFront } from './render/module';
import { drawNotebook, notebookHit } from './render/notebook';
import { drawReveal, type Reveal } from './render/reveal';
import { P } from './render/palette';
import { drawDropZone, overDropZone } from './render/dropzone';
import { COARSE, Screen, VIEW_H, VIEW_W } from './render/screen';
import { drawDust, drawGrain, drawTemperature, drawVignette } from './render/finish';
import { drawSeasonTint, skyColor } from './render/weather';
import { computeEntrainment, isUsualHour, type Entrainment } from './sim/entrainment';
import { beginAction } from './sim/behavior';
import { buildGraph, floorOfFurniture, type FloorGraph } from './sim/floors';
import { giftProgress, openGift } from './sim/gift';
import { canSitOnShelf, Habitat, MAX_ACTIVE, MY_BREED } from './sim/habitat';
import { createHamster, updateHamster } from './sim/hamster';
import { activeVisitors, affinityFor } from './sim/visitors';
import { triggerNotice } from './sim/notice';
import { computePrefs, type Prefs } from './sim/prefs';
import { DEFAULT_WAKE_CURVE } from './sim/schedule';
import { seasonOf, weatherOf } from './sim/season';
import type { Hamster, Pointer, WorldCtx } from './sim/types';
import { BREED_IDS, type BreedId } from './content/breeds';
import { NamingUI } from './ui/naming';
import { NotebookUI } from './ui/notebook';
import { groundY, INNER_MAX, INNER_MIN, MODULE_W, originX, type Cell } from './world';

const canvas = document.getElementById('screen') as HTMLCanvasElement;
const screen = new Screen(canvas);

const boot = performance.timeOrigin + performance.now();
resetIfAsked(); // ?reset — 개발 중에만. 진짜 세이브를 지우고 처음부터.
clearDemoStorage(); // ?demo는 언제나 새로 시작한다 (진짜 세이브는 안 건드림)
const log = await EventLog.load(boot);

const tabLock = new TabLock(boot);
log.readOnly = !tabLock.primary;

const wasFirstEver = log.count('session.start') === 0;
const rng = createRng(log.seed);
const hab = new Habitat(log);
if (DEMO_MODE) seedDemo(log, hab, boot);
const hamster = createHamster(boot, rng, wasFirstEver && !DEMO_MODE);
const sfx = new Sfx();
const camera = new Camera();

let graph: FloorGraph = buildGraph(hab);

const journal = new Journal(log);
journal.catchUp(boot);

/**
 * 손님들. 날짜+시드로 결정되니까 앱을 꺼둔 사이에도 왔다 간 게 된다.
 * 서버도 백그라운드 실행도 필요 없다.
 */
const visitors: Hamster[] = [];
const visitorIds = new Map<string, Hamster>();

function syncVisitors(now: number): void {
  const active = activeVisitors(now, log.seed);
  const wanted = new Set(active.map((v) => v.id));

  // 떠난 손님 보내기
  for (const [id, h] of [...visitorIds]) {
    if (wanted.has(id)) continue;
    visitorIds.delete(id);
    const i = visitors.indexOf(h);
    if (i >= 0) visitors.splice(i, 1);
  }

  // 새로 온 손님 맞이하기
  for (const spec of active) {
    if (visitorIds.has(spec.id)) continue;
    const grounds = graph.floors.filter((f) => f.kind === 'ground');
    const fl = grounds[Math.floor(rng.next() * grounds.length)] ?? graph.floors[0];
    if (!fl) continue;
    const guest = createHamster(now, rng, false, {
      breed: spec.breed,
      leaveAt: spec.to,
      floorId: fl.id,
      x: rng.range(fl.x0, fl.x1),
      y: fl.y,
    });
    visitorIds.set(spec.id, guest);
    visitors.push(guest);
    if (!log.all().some((e) => e.type === 'visitor.came' && e.data?.vid === spec.id)) {
      log.append(Math.max(spec.from, log.createdAt), 'visitor.came', {
        vid: spec.id,
        breed: spec.breed,
      });
    }
  }
}

/**
 * ★ 같이 사는 애들 — 손님과는 다른 것이다.
 *
 * 손님은 날짜로 정해져서 왔다가 가는 날씨지만, 이 애들은 여기 산다.
 * 그래서 `isVisitor`가 false다 — 자고, 쓰다듬을 수 있고, 굴에도 들어간다.
 * 그 관계값(낯가림·편안함·주목)은 원래부터 마리마다 따로 들고 있어서
 * 각각 따로 친해지는 게 그냥 된다.
 *
 * 다만 일지와 생활리듬은 집안 단위다. 골든이 이 방의 주인이고, 그건 안 바뀐다.
 */
const companions = new Map<BreedId, Hamster>();

function syncCompanions(now: number): void {
  for (const [breed, h] of [...companions]) {
    if (!hab.active.includes(breed)) {
      // 들고 있는 애를 이동장에 넣으면 손이 빈다
      if (h.held) h.held = false;
      companions.delete(breed);
    }
  }
  for (const breed of hab.active) {
    if (breed === MY_BREED || companions.has(breed)) continue;
    const grounds = graph.floors.filter((f) => f.kind === 'ground');
    const fl = grounds[Math.floor(rng.next() * grounds.length)] ?? graph.floors[0];
    if (!fl) continue;
    companions.set(
      breed,
      createHamster(now, rng, false, {
        breed,
        leaveAt: Infinity, // 안 떠난다
        floorId: fl.id,
        x: rng.range(fl.x0, fl.x1),
        y: fl.y,
      }),
    );
  }
}

/**
 * 이동장에서 꺼내고 넣는다.
 *
 * 골든은 넣을 수 없다 — 이 방의 주인이고, 넣는 순간 빈 방이 된다.
 * 세 마리가 차 있으면 더 못 꺼낸다. 쿨타임도 비용도 없다.
 */
function toggleActive(breed: BreedId, now: number): void {
  if (!hab.hamsters.has(breed) || breed === MY_BREED) return;
  const i = hab.active.indexOf(breed);
  if (i >= 0) hab.active.splice(i, 1);
  else if (hab.active.length >= MAX_ACTIVE) return;
  else hab.active.push(breed);
  hab.saveNow();
  syncCompanions(now);
  sfx.play('rustle', 0.8);
}

/**
 * ★ 러닝휠은 스스로 안 돈다.
 *
 * 시간으로 계속 돌리면 아무도 안 타는데 혼자 돌아가는 바퀴가 된다.
 * 그건 배경 장식이지 햄스터가 쓰는 물건이 아니다. **누가 타고 있을 때만**
 * 돌고, 내려오면 조금 더 돌다가 멈춘다(관성).
 *
 * 각도는 저장하지 않는다 — 바퀴가 몇 도 돌아가 있었는지는 기억이 아니다.
 */
const spin = new Map<number, number>();
const spinVel = new Map<number, number>();

function updateSpin(dt: number): void {
  const riding = new Set<number>();
  /** 관 속에 있는 애 — 몸통을 한 번 더 덮어서 가려야 한다 */
  const inTube = new Set<number>();
  for (const h of [hamster, ...companions.values(), ...visitors]) {
    if (h.action !== 'useSpot' || h.spotPhase !== 1) continue;
    if (h.spotAff === 'run') riding.add(h.spotIndex);
    const f = hab.furniture[h.spotIndex];
    if (f && FURNITURE[f.id].tube) inTube.add(h.spotIndex);
  }
  /** 물을 마시고 있는 급수기 */
  const sipping = new Set<number>();
  for (const h of [hamster, ...companions.values(), ...visitors]) {
    if (h.action === 'useSpot' && h.spotPhase === 1 && h.spotAff === 'drink') {
      sipping.add(h.spotIndex);
    }
  }

  for (let i = 0; i < hab.furniture.length; i++) {
    const def = FURNITURE[hab.furniture[i]!.id];
    if (def.tube) {
      // 관은 각도가 아니라 '누가 안에 있나'만 쓴다
      spin.set(i, inTube.has(i) ? 1 : 0);
      continue;
    }
    if (def.affords.includes('drink')) {
      /**
       * 급수기는 '남은 물'을 쓴다. 마시면 줄고, 놓아두면 다시 찬다.
       * 채우는 게 두 배 이상 빠르다 — 물이 떨어져 있는 걸 보게 만들면
       * 그건 돌봐야 할 일이 되고, 이 게임엔 그런 게 없다.
       */
      const cur = spin.get(i) ?? 1;
      spin.set(i, clamp(cur + (sipping.has(i) ? -0.13 : 0.3) * dt, 0.08, 1));
      continue;
    }
    const target = riding.has(i) ? 5.2 : 0;
    const v = lerp(spinVel.get(i) ?? 0, target, riding.has(i) ? 0.06 : 0.02);
    if (v < 0.01 && target === 0) {
      spinVel.delete(i);
      continue;
    }
    spinVel.set(i, v);
    spin.set(i, (spin.get(i) ?? 0) + v * dt);
  }
}

/**
 * ★ 가구를 톡 누르면 부르는 것이 된다 — 시키는 것이 아니라.
 *
 * "러닝휠을 누르면 탄다"를 명령으로 만들면 햄스터가 인형이 된다. 이 게임이
 * 지금까지 지켜온 건 **얘는 스스로 정한다**는 것이고, 그게 무너지면 나머지
 * 전부(낯가림·쓰다듬기 거절·늘어짐)가 같이 값을 잃는다.
 *
 * 그래서 부르기다. 누르면 **반드시** 그쪽을 본다 — 그게 눌렸다는 대답이다.
 * 그 다음은 얘가 정한다:
 *
 *   · 자고 있으면 안 온다. 귀만 쫑긋한다. (절대 놀라서 깨우지 않는다)
 *   · 낯가리는 중이면 안 온다.
 *   · 그 외에는 온다. 순간이동이 아니라 걸어서.
 *
 * 걸어오는 그 몇 초가 '내가 부르니까 와줬다'를 만든다. 즉시 타버리면
 * 버튼을 누른 것이지 부른 게 아니다.
 */
function inviteTo(index: number): void {
  const f = hab.furniture[index];
  if (!f) return;
  const def = FURNITURE[f.id];
  if (def.affords.length === 0) return;

  const spot = hab.spotX(f);
  // 올 수 있는 애 중 제일 가까운 애가 대답한다
  const crew = [hamster, ...companions.values()].filter((h) => !h.held && !h.falling);
  const who = crew.sort((a, b) => Math.abs(a.wx - spot) - Math.abs(b.wx - spot))[0];
  if (!who) return;

  // 무엇을 하든 일단 주목한다 — 이게 '눌렸다'의 대답이다
  who.attention = Math.min(1, who.attention + 0.6);
  who.earPerk = 1;

  if (who.asleep || who.shy > 0 || who.travel) {
    who.earTwitchVel += 9; // 들리긴 했다는 표시
    return;
  }

  const fl = floorOfFurniture(graph, f);
  if (!fl) return;
  beginAction(who, ctx, 'useSpot', 10 + rng.range(0, 6));
  who.spotIndex = index;
  who.spotAff = def.affords[0]!;
  who.spotPhase = 0;
  who.goal = { floorId: fl.id, x: spot };
  sfx.play('sniff', 0.5);
}

let prefs: Prefs = computePrefs(log, log.seed);
let entrainment: Entrainment = { curve: [...DEFAULT_WAKE_CURVE], strength: 0, usualHours: [] };

const dayNumber = (now: number): number => {
  const a = dayKeyOf(log.createdAt).split('-').map(Number);
  const b = dayKeyOf(now).split('-').map(Number);
  const ta = new Date(a[0]!, a[1]! - 1, a[2]!).getTime();
  const tb = new Date(b[0]!, b[1]! - 1, b[2]!).getTime();
  return Math.round((tb - ta) / 86_400_000) + 1;
};

// ── 공책 / 이름 ──────────────────────────────────────────
let journalCount = 0;
let journalUnread = 0;
const refreshJournalCache = () => {
  journalCount = journal.entries().length;
  journalUnread = journal.unreadCount();
};
refreshJournalCache();

let modalOpen = false;
const notebookUI = new NotebookUI(journal, () => {
  modalOpen = false;
  refreshJournalCache();
});

let namingAsked = false;
const namingUI = new NamingUI((name) => {
  modalOpen = false;
  if (name) {
    const t = performance.timeOrigin + performance.now();
    log.append(t, 'hamster.named', { name });
    log.flush(t, true);
  }
});

for (const ev of ['pointerdown', 'keydown', 'touchstart', 'pointermove']) {
  window.addEventListener(ev, () => sfx.unlock(), { passive: true });
}

// ── 포인터 ──────────────────────────────────────────────
const pointer: Pointer = { x: -999, y: -999, inside: false, speed: 0, still: 0 };
const worldPointer = { x: 0, y: 0 };
let clientX = -9999;
let clientY = -9999;
let sawPointer = false;
let prevX = 0;
let prevY = 0;
let outsideFor = 999;

type Tray = 'none' | 'food' | 'shelf' | 'substrate' | 'hamster';
let tray: Tray = 'none';
let substrateCell: Cell | null = null;
let hoverNotebook = false;
let hoverJar = false;
let hoverCrate = false;
let hoverGift = false;
let hoverCarrier = false;
/** 소포를 연 직후 보여주는 화면. null이면 아무 일도 없다. */
let reveal: Reveal | null = null;
/** 잠깐 떴다 사라지는 한 줄 — 지금은 소포에만 쓴다 */
let toast: { text: string; t: number } | null = null;
let trayHover = -1;
let dragIndex = -1;
/** 옮기기 전 자리 — Esc로 되돌릴 때 쓴다 */
let dragOrigin: { cx: number; cy: number; x: number } | null = null;
/** 끌었나, 톡 눌렀나 — 손 뗄 때 옮기기와 부르기를 가른다 */
let dragMoved = false;
let dragOffset = 0;
let dragNew: FurnitureId | null = null;
let newSince = 0;
/** 들고 있는 물건이 커서를 따라오며 기울어지는 정도 — 이게 '무게'다 */
let carryTilt = 0;
let prevCarryX = 0;
const CRATE_SEEN = 'hamster.crateSeen.v1';
let neverOpenedCrate = localStorage.getItem(CRATE_SEEN) !== '1';

/**
 * ★ 손가락 기기: 톡 = 상호작용, 길게 **또는 끌면** = 집기.
 *
 * 예전엔 누르는 순간 바로 집혔다. 폰에서는 손가락이 늘 조금씩 흔들리니까,
 * 부르려던 것이 자꾸 '옮기려 했다'로 판정됐다. 햄스터는 더 나빴다 —
 * 만지려면 반드시 들어올려야 했다. **납치하지 않고는 인사할 수가 없었다.**
 *
 * 살아있는 걸 들어올리는 건 작정해야 하는 일이어야 한다. 톡은 인사다.
 *
 * 마우스는 이 문제가 없다(뾰족하고 안 흔들린다). 데스크톱에서 길게 누르기를
 * 요구하면 멀쩡하던 조작이 느려지기만 한다. 그래서 손가락일 때만 갈라진다.
 */
const HOLD_MS = 380;
/**
 * ★ 이만큼 끌면 기다리지 않고 바로 집는다.
 *
 * 처음엔 반대로 했다 — 380ms 안에 7px 넘게 움직이면 집기를 **취소**했다.
 * 스크롤과 길게 누르기를 가르는 흔한 방법이라 그대로 가져왔는데,
 * 이 게임에는 스크롤이 없다. 남은 건 부작용뿐이었다:
 *
 *   물건을 옮기려는 사람은 누르자마자 끈다. 가만히 있을 이유가 없다.
 *   그래서 **아무것도 안 움직였다.** 정확히 380ms를 참은 사람만 옮길 수
 *   있었으니, 사실상 이동 기능이 없는 것과 같았다.
 *
 * 그래서 뒤집었다. 끄는 건 집으려는 뜻이 분명하니 기다릴 이유가 없다.
 * 톡(짧고 안 움직임)만 상호작용으로 남는다.
 *
 * 14는 손가락 떨림보다 확실히 크고(화면에서 약 24px) 의도적으로 끄는
 * 것보다는 작다. 3px이었다면 부르려다 옮기게 되고, 40px이었다면
 * 끌기 시작한 뒤에도 한참 안 따라온다.
 */
const DRAG_GRAB = 14;

type Pending = {
  kind: 'hamster' | 'furniture';
  index: number;
  t0: number;
  vx: number;
  vy: number;
};
/** 아직 집을지 부를지 안 정해진 누름 (손가락 기기에서만 생긴다) */
let pending: Pending | null = null;
/** 0→1. 길게 누르는 동안 차오르는 표시 — 없으면 고장 난 줄 안다 */
let holdT = 0;
/** 놓는 자리가 나타나는 정도 */
let dropT = 0;

/** 폰이 손끝으로 대답해준다. 없는 기기에서는 조용히 아무 일도 안 한다. */
function buzz(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 지원 안 하면 그만이다 */
  }
}

function clearPending(): void {
  pending = null;
  holdT = 0;
}

/**
 * 지금 손을 떼면 상자로 들어가는가.
 *
 * ★ 불이 들어오는 판단과 실제로 들어가는 판단이 **같은 함수**여야 한다.
 *   따로 두면 불은 켜졌는데 안 들어가거나, 안 켜졌는데 들어간다.
 *   후자는 물건이 소리 없이 치워지는 것이라 특히 나쁘다.
 */
function overCrate(vx: number, vy: number, wx: number, wy: number): boolean {
  if (cellOfPoint(hab, wx, wy)) return false; // 사육장이 이긴다
  return overDropZone(vx, vy);
}

function grabHamster(now: number): void {
  hamster.held = true;
  hamster.falling = false; // 떨어지는 중에 다시 잡을 수 있다
  hamster.petting = false;
  sfx.play('rustle', 0.7);
  if (!log.all().some((ev) => ev.type === 'hamster.held')) {
    log.append(now, 'hamster.held');
  }
}

function grabFurniture(idx: number, wx: number): void {
  const f = hab.furniture[idx];
  if (!f) return;
  dragIndex = idx;
  dragOffset = wx - (originX(f.cx) + f.x);
  // 취소할 때 되돌릴 자리를 기억해 둔다
  dragOrigin = { cx: f.cx, cy: f.cy, x: f.x };
  // 톡 누른 것과 끌어서 옮긴 것을 손 뗄 때 구분한다
  dragMoved = false;
}

/**
 * 톡 눌렀다 — 집으려던 게 아니다.
 *
 * 햄스터는 인사, 가구는 부르기. 쓰다듬기가 원래 '호버 0.28초'로 되어
 * 있어서 폰에서는 아예 닿을 수가 없었다. 손가락엔 호버가 없으니까.
 * 이 게임에서 제일 다정한 동작이 폰에서만 없던 셈이다.
 */
function tapOn(p: Pending): void {
  if (p.kind === 'hamster') {
    if (hamster.asleep) {
      hamster.earTwitchVel += 9; // 자는 애는 안 깨운다. 들리긴 했다는 표시만.
      return;
    }
    /**
     * ★ 톡 = 쓰다듬기 시도.
     *
     * 처음엔 아무것도 안 하고 원래 길(포인터를 가만히 두면 0.28초 뒤
     * 판정)에 맡겼다. 손을 떼도 마지막 손가락 자리가 포인터로 남으니까
     * 될 줄 알았는데, 재보니 안 됐다 — 햄스터가 그 사이 걸어가버리면
     * 접촉이 끊기고, 남은 건 화면에 박힌 유령 포인터뿐이다.
     *
     * 애초에 '손을 떼도 계속 올려두고 있다'는 건 마우스 발상이었다.
     *
     * 그래서 톡이 판정을 직접 부른다. 다만 **성공시키는 게 아니라
     * 물어보는 것**이다 — 받아줄지 튕길지는 그대로 햄스터가 정한다.
     * 거절할 수 있어야 승낙이 의미를 갖는다.
     */
    hamster.attention = Math.min(1, hamster.attention + 0.5);
    hamster.earPerk = 1;
    hamster.petPoke = 0.3; // '가만히 있었다' 대신 — 받아줄지는 얘가 정한다
  } else {
    inviteTo(p.index);
  }
}

window.addEventListener(
  'pointermove',
  (e: PointerEvent) => {
    clientX = e.clientX;
    clientY = e.clientY;
    sawPointer = true;
  },
  { passive: true },
);
document.addEventListener('pointerleave', () => {
  sawPointer = false;
});

/** 이 지점을 눌러서 햄스터를 집을 수 있는가 */
function overHamster(wx: number, wy: number): boolean {
  return Math.hypot(wx - hamster.wx, wy - (hamster.wy - 11)) < 22;
}

/**
 * 손에서 내려놓는다.
 * 놓은 자리 아래에 있는 바닥을 찾아 거기 세운다 — 허공에 두면 안 되니까.
 */
function putDown(wx: number, wy: number): void {
  const grounds = graph.floors.filter((f) => wx >= f.x0 - 14 && wx <= f.x1 + 14);
  // 손 아래쪽에서 제일 가까운 바닥. 없으면 아무 바닥이나.
  let best = grounds.filter((f) => f.y >= wy - 8).sort((a, b) => a.y - b.y)[0];
  best ??= grounds.sort((a, b) => Math.abs(a.y - wy) - Math.abs(b.y - wy))[0];
  best ??= graph.floors[0];
  if (!best) return;

  hamster.held = false;
  hamster.floorId = best.id;
  hamster.floorY = best.y;
  hamster.floorX0 = best.x0;
  hamster.floorX1 = best.x1;
  hamster.wx = clamp(wx, best.x0, best.x1);
  hamster.vx = 0;

  // 높이서 놓으면 허둥대며 떨어진다. 바닥 가까이면 그냥 내려놓은 거다.
  if (hamster.wy < best.y - 8) {
    hamster.falling = true;
    hamster.fallVy = 0;
  } else {
    hamster.wy = best.y;
    hamster.landSquash = 1;
    sfx.play('settle', 0.9);
  }
}

/**
 * ★ 땅속은 안 그린다.
 *
 * 파고들면 톱밥 표면 아래는 그냥 잘라낸다. 잘린 단면은 그 위에 덮는
 * 봉우리가 가린다 — 그래서 봉우리는 반드시 햄스터 **뒤에** 그려야 한다.
 *
 * 한때 단면에 구멍을 파서 땅속까지 보여줬는데, 그 검은 구멍 하나가
 * 사육장에서 제일 어두운 면이 되면서 그림을 망쳤다. 안 보이는 편이 세다.
 */
function drawInBurrow(c: CanvasRenderingContext2D, h: typeof hamster, now: number): void {
  if (h.dig < 0.01) {
    drawHamster(c, h);
    return;
  }
  const b = hab.burrowNear(h.wx, now, 10);
  const bx = b?.x ?? h.wx;

  drawBurrowHole(c, bx, h.dig);

  // 톱밥 위 / 구멍 안, 두 영역에 나눠 그린다. 하나의 경로로 합치려면
  // 감김 방향을 맞춰야 해서 조용히 틀리기 쉽다. 두 영역이 표면선에서
  // 맞닿고 겹치지 않아서 이중으로 그려지는 픽셀도 없다.
  c.save();
  abovePath(c);
  c.clip();
  drawHamster(c, h);
  c.restore();

  c.save();
  if (burrowPath(c, bx, h.dig)) {
    c.clip();
    drawHamster(c, h);
  }
  c.restore();

  drawBurrowMound(c, hab, h, now);
}

/** 내려놓으면 여기 선다 — 들고 있는 동안 바닥에 깔리는 그림자 */
function drawDropShadow(c: CanvasRenderingContext2D, wx: number): void {
  const f = graph.floors
    .filter((fl) => wx >= fl.x0 - 14 && wx <= fl.x1 + 14 && fl.y >= hamster.wy - 8)
    .sort((a, b) => a.y - b.y)[0];
  if (!f) return;
  c.globalAlpha = 0.3;
  c.fillStyle = '#4a3524';
  c.beginPath();
  c.ellipse(clamp(wx, f.x0, f.x1), f.y, 11, 3, 0, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
}

/** 이 지점에 놓인 가구 (없으면 -1). 위에 놓인 것부터 본다. */
function furnitureAt(wx: number, wy: number): number {
  for (let i = hab.furniture.length - 1; i >= 0; i--) {
    const r = furnitureRect(hab.furniture[i]!);
    if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return i;
  }
  return -1;
}

canvas.addEventListener('pointerdown', (e) => {
  const v = screen.toView(e.clientX, e.clientY);
  if (!v.inside || modalOpen) return;
  const now = performance.timeOrigin + performance.now();
  const w = camera.toWorld(v.x, v.y);

  // 소포 결과가 떠 있으면 아무 데나 눌러 닫는다. 그 외 조작은 안 먹는다.
  if (reveal) {
    if (reveal.t > 0.25) reveal = null;
    return;
  }

  if (tray === 'food') {
    const i = foodTrayIndex(v.x, v.y);
    if (i >= 0) {
      hab.bowlFood = FOOD_IDS[i]!;
      log.append(now, 'food.given', { food: FOOD_IDS[i]! });
      hamster.hunger = Math.min(1, hamster.hunger + 0.15);
      tray = 'none';
      return;
    }
  } else if (tray === 'shelf') {
    const i = shelfTrayIndex(v.x, v.y);
    const id = i >= 0 ? FURNITURE_IDS[i] : undefined;
    if (id && hab.canPlace(id)) {
      dragNew = id;
      tray = 'none';
      return;
    }
    // 이미 나가 있는 것 — 왜 안 집히는지 말해준다. 안 그러면 고장으로 읽힌다.
    if (id && hab.unlocked.has(id) && hab.isPlaced(id)) {
      toast = { text: '이미 놓여 있어요', t: 0 };
      return;
    }
  } else if (tray === 'hamster') {
    const i = hamsterTrayIndex(v.x, v.y);
    const b = i >= 0 ? BREED_IDS[i] : undefined;
    if (b) {
      toggleActive(b, now);
      return;
    }
  } else if (tray === 'substrate') {
    const i = substrateTrayIndex(v.x, v.y);
    if (i >= 0 && substrateCell) {
      hab.setSubstrate(substrateCell, SUBSTRATE_IDS[i]!);
      sfx.play('rustle', 0.9);
      tray = 'none';
      return;
    }
  }

  const d = toDesk(v.x, v.y);
  if (journalCount > 0 && notebookHit(d.x, d.y)) {
    modalOpen = true;
    tray = 'none';
    notebookUI.show();
    return;
  }
  // 오늘 소포 — 열면 하나 나오고 상자는 사라진다
  // 오늘 소포 — 열면 하나 나오고, 자정까지 색이 다시 차오른다
  if (hit(giftRect(), d.x, d.y)) {
    const got = openGift(hab, now, log.seed);
    if (got) {
      reveal = { item: got, t: 0 };
      if (got.kind === 'hamster') syncCompanions(now);
      tray = 'none';
      sfx.play('squeak', 0.7);
    } else {
      // 아직 안 찼다 — 언제 오는지만 알려준다
      toast = { text: '내일 받을 수 있어요', t: 0 };
    }
    return;
  }
  if (hit(carrierRect(), d.x, d.y)) {
    tray = tray === 'hamster' ? 'none' : 'hamster';
    return;
  }
  if (hit(jarRect(), d.x, d.y)) {
    tray = tray === 'food' ? 'none' : 'food';
    return;
  }
  if (hit(crateRect(), d.x, d.y)) {
    // 상자에는 가구만 들어 있다. 방 조각과 관이 있던 자리다.
    tray = tray === 'shelf' ? 'none' : 'shelf';
    if (tray === 'shelf') newSince = hab.unlocked.size;
    neverOpenedCrate = false;
    localStorage.setItem(CRATE_SEEN, '1');
    return;
  }

  // 햄스터가 가구보다 먼저다 — 겹쳐 있으면 주인공을 집는다
  if (overHamster(w.x, w.y)) {
    tray = 'none';
    // 손가락이면 아직 집지 않는다. 톡이면 인사, 길게면 들어올리기.
    if (COARSE) pending = { kind: 'hamster', index: -1, t0: now, vx: v.x, vy: v.y };
    else grabHamster(now);
    return;
  }

  const idx = furnitureAt(w.x, w.y);
  if (idx >= 0) {
    tray = 'none';
    if (COARSE) pending = { kind: 'furniture', index: idx, t0: now, vx: v.x, vy: v.y };
    else grabFurniture(idx, w.x);
    return;
  }

  // 방 바닥을 누르면 바닥재를 고른다.
  // 벽지는 못 고른다 — 어차피 네 색 다 어울려서 고를 게 없고,
  // 고를 게 없는 걸 고르게 하면 그건 선택이 아니라 일이다.
  const roomCell = cellOfPoint(hab, w.x, w.y);
  if (roomCell) {
    const gy = groundY(roomCell.cy);
    if (w.y >= gy - 2 && w.y <= gy + 30) {
      substrateCell = roomCell;
      tray = 'substrate';
      return;
    }
  }

  tray = 'none';
});

window.addEventListener('pointerup', () => {
  const now = performance.timeOrigin + performance.now();
  const v = screen.toView(clientX, clientY);
  const w = camera.toWorld(v.x, v.y);

  // 길게 누르기가 익기 전에 손을 뗐다 → 톡이다. 집는 게 아니라 부르는 것.
  if (pending) {
    const p = pending;
    clearPending();
    tapOn(p);
    return;
  }

  /**
   * 햄스터에는 놓는 자리를 안 띄운다.
   *
   * 집을 수 있는 건 '내 햄스터'뿐이고(overHamster), 내 햄스터는 MY_BREED라
   * 이동장으로 보낼 수가 없다. 띄워놓으면 눌러도 아무 일이 안 일어나는
   * 자리가 된다. 안 되는 걸 보여주는 게 안 보여주는 것보다 나쁘다.
   *
   * 같이 사는 애들을 집을 수 있게 되면 그때 이어붙일 자리다.
   */
  if (hamster.held) putDown(w.x, w.y);

  if (dragNew) {
    const cell = cellOfPoint(hab, w.x, w.y);
    // 꺼내던 걸 상자 위에 도로 놓으면 그냥 없던 일이 된다 — 취소하는 길.
    // 여기서도 사육장이 이긴다 (위 dragIndex 블록의 이유와 같다)
    if (!cell && overDropZone(v.x, v.y)) {
      dragNew = null;
      dropT = 0;
    } else if (v.inside && cell) {
      // 벽에 거는 물건은 가까운 쪽 벽으로 붙는다
      if (FURNITURE[dragNew].mount === 'wall') {
        const s = hab.snapToWall(dragNew, w.x);
        hab.place(dragNew, s.cell, s.x, now);
      } else {
        hab.place(dragNew, cell, w.x - originX(cell.cx) - FURNITURE[dragNew].w / 2, now, liftFor(dragNew, w));
      }
      sfx.play('rustle', 0.8);
    }
    dragNew = null;
  }
  if (dragIndex >= 0) {
    /**
     * ★ 사육장 안이면 무조건 놓는 쪽이 이긴다.
     *
     * 자리를 아무리 잘 잡아도 화면 크기에 따라 상자 자리가 사육장 바닥과
     * 겹칠 수 있다. 실제로 폰에서 겹쳐서, 사육장 한가운데에 놓으려던 물건이
     * 상자로 들어갔다 — 옮기려던 게 치워졌으니 제일 나쁜 종류의 오작동이다.
     *
     * 좌표로 안 겹치게 맞추는 건 화면 하나 바뀌면 또 깨진다.
     * '놓을 수 있는 칸 위면 놓는다'로 못 박으면 겹칠 수가 없다.
     */
    if (overCrate(v.x, v.y, w.x, w.y)) {
      // 상자에 넣는다 — 없어지는 게 아니라 장난감통으로 돌아간다
      hab.remove(dragIndex);
      sfx.play('rustle', 0.6);
      buzz(12);
      toast = { text: '상자에 넣었어요', t: 0 };
    } else if (!dragMoved) {
      /**
       * 끌지 않고 톡 눌렀다 — 옮기려던 게 아니라 부른 것이다.
       * 손가락이 조금 흔들린 만큼은 원래 자리로 되돌린 뒤 부른다.
       */
      if (dragOrigin) hab.move(dragIndex, { cx: dragOrigin.cx, cy: dragOrigin.cy }, dragOrigin.x);
      inviteTo(dragIndex);
    } else {
      const cell = cellOfPoint(hab, w.x, w.y);
      if (!v.inside || !cell) {
        /**
         * ★ 엉뚱한 데 놓으면 지우지 않고 되돌린다.
         *
         * 예전엔 여기서 그냥 없앴다. "칸 밖에 놓으면 삭제"는 보이지도
         * 알려주지도 않는 규칙이라, 치우려는 사람은 못 찾고 옮기려던
         * 사람은 실수로 없앴다. 이제 없애는 자리가 화면에 있으니
         * 여기서는 안전한 쪽으로만 간다.
         */
        if (dragOrigin) hab.move(dragIndex, { cx: dragOrigin.cx, cy: dragOrigin.cy }, dragOrigin.x);
      }
    }
    dragIndex = -1;
    dragOrigin = null;
    dropT = 0;
  }
  if (dragNew === null && dragIndex < 0) dropT = 0;
});

// ── 접속 감지 ───────────────────────────────────────────
let pendingNotice = false;
const presence = new Presence(
  boot,
  (t) => {
    log.append(t, 'session.start');
    pendingNotice = true;
    hab.resetSignals();
    if (!hamster.asleep && entrainment.strength >= 0.45 && isUsualHour(entrainment, t)) {
      log.append(t, 'hamster.wokeEarly');
    }
    if (!namingAsked && !log.name && log.count('pet.accepted') >= 1) {
      namingAsked = true;
      modalOpen = true;
      setTimeout(() => namingUI.show(), 2200);
    }
  },
  (t, ms) => {
    log.append(t, 'session.end', { ms: Math.round(ms) });
    log.flush(t, true);
  },
);

// ── 디버그 ──────────────────────────────────────────────
let debug = false;
window.addEventListener('keydown', (e) => {
  if (modalOpen) return;
  if (e.key === 'd' || e.key === 'D') debug = !debug;
  if (e.key === 'e' || e.key === 'E') downloadSave();
  if (e.key === 'm' || e.key === 'M') sfx.toggleMute();
  if (e.key === 'Escape') cancelDrag();
});

/**
 * ★ 놓다 마는 길.
 *
 * 집었는데 마음이 바뀌는 일은 자주 있다. 그때 아무 데나 놓아야만 한다면
 * 그건 배치가 아니라 함정이다. 빠져나갈 길이 둘 있다:
 *
 *   · Esc — 집기 전 자리로 정확히 되돌린다 (옮기던 것이면 원래 자리, 새 것이면 상자로)
 *   · 사육장 밖에 놓기 — 상자에 도로 넣는다
 *
 * 두 번째는 원래도 그렇게 동작했는데 아무 표시가 없어서 '떨어뜨렸다'로
 * 읽혔다. 이제 그 상태에서 상자가 밝아진다 — 손이 어디로 향하는지 상자가 알려준다.
 */
function cancelDrag(): void {
  if (dragNew) {
    dragNew = null;
    sfx.play('rustle', 0.5);
    return;
  }
  if (dragIndex >= 0 && dragOrigin) {
    hab.move(dragIndex, { cx: dragOrigin.cx, cy: dragOrigin.cy }, dragOrigin.x);
    dragIndex = -1;
    dragOrigin = null;
    sfx.play('rustle', 0.5);
    return;
  }
  tray = 'none';
}

/**
 * 이 자리에 놓으면 선반 위인가, 톱밥 위인가.
 *
 * 손이 선반 상판 근처에 있으면 그 높이에 얹는다. 큰 물건과 층을 만드는
 * 물건(선반·사다리·망루)은 아예 안 얹힌다 — 층이 층을 낳으면 바닥 그래프가
 * 감당 못 하는 모양이 된다.
 */
function liftFor(id: FurnitureId, w: { x: number; y: number }): number {
  if (!canSitOnShelf(id)) return 0;
  return hab.liftAt(w.x, w.y, FURNITURE[id].w);
}

/** 지금 손을 놓으면 상자로 돌아가는가 */
function willReturn(): boolean {
  if (!dragNew && dragIndex < 0) return false;
  const v = screen.toView(clientX, clientY);
  if (!v.inside) return true;
  const w = camera.toWorld(v.x, v.y);
  return cellOfPoint(hab, w.x, w.y) === null;
}

function downloadSave(): void {
  const blob = new Blob([log.exportJson()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hamster-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

for (const ev of ['pagehide', 'blur']) {
  window.addEventListener(ev, () => log.flush(performance.timeOrigin + performance.now(), true));
}
window.addEventListener('pagehide', () => tabLock.release());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) log.flush(performance.timeOrigin + performance.now(), true);
});

// ── 월드 ────────────────────────────────────────────────
const ctx: WorldCtx = {
  now: boot,
  dt: 1 / 30,
  rng,
  ground: 0,
  minX: INNER_MIN,
  maxX: INNER_MAX,
  pointer,
  worldPointer,
  present: false,
  familiarity: log.familiarity(),
  petCount: log.count('pet.accepted'),
  wakeCurve: DEFAULT_WAKE_CURVE,
  hab,
  prefs,
  season: seasonOf(boot),
  weather: weatherOf(boot, log.seed),
  graph,
  bed: { floorId: '', x: 76 },
  visitors,
  guestFeeling: (breed) =>
    affinityFor(breed, log.seed, log.ofType('visitor.came').filter((e) => e.data?.breed === breed).length),
  emit: (type, data) => log.append(ctx.now, type, data),
  sound: (id, gain) => sfx.play(id, gain),
};

function recomputeDerived(now: number): void {
  entrainment = computeEntrainment(
    log.ofType('session.start').map((e) => e.t),
    now,
  );
  prefs = computePrefs(log, log.seed);
  ctx.wakeCurve = entrainment.curve;
  ctx.prefs = prefs;
  ctx.season = seasonOf(now);
  ctx.weather = weatherOf(now, log.seed);

  /**
   * ★ 굴이 충분히 깊으면 거기가 잠자리다.
   *
   * 아무리 예쁜 집을 사줘도 실제 햄스터는 자기가 판 굴에서 잔다. 그게 좀
   * 서운한 대목인데, 서운한 게 맞다 — 잠자리를 그녀가 못 정한다는 사실이
   * 이 햄스터가 소품이 아니라는 걸 제일 분명하게 말해준다.
   * 굴을 얕게 파다 만 동안은 아직 사준 집에서 잔다.
   */
  // 굴이 여러 개면 제일 깊은 데서 잔다
  const den = hab.deepestBurrow(now);
  const burrowFloor =
    den && hab.burrowDepth(den, now) > 0.55
      ? (graph.floors.find(
          (f) => f.kind === 'ground' && den.x >= f.x0 && den.x <= f.x1,
        ) ?? null)
      : null;

  const beds = hab.affordAll('sleep');
  const fav = beds.find((b) => b.id === prefs.favoriteSpot) ?? beds[0];
  const bedFloor = fav ? floorOfFurniture(graph, fav) : null;
  ctx.bed =
    burrowFloor && den
      ? { floorId: burrowFloor.id, x: den.x }
      : fav && bedFloor
        ? { floorId: bedFloor.id, x: hab.spotX(fav) }
        : { floorId: hamster.floorId, x: hamster.floorX1 - 20 };

  hab.checkTimedUnlocks(now, dayNumber(now));
}
recomputeDerived(boot);

let nextDerivedAt = boot + 60_000;
let nextCatchUpAt = boot + 60_000;
let nextStatsAt = boot;

startLoop({
  hz: 30,
  update(dt, now) {
    presence.update(now);
    tabLock.update(now);
    log.readOnly = !tabLock.primary;

    camera.update(hab.cells(), dt, { x: hamster.wx, y: hamster.wy });

    const v = screen.toView(clientX, clientY);
    pointer.x = v.x;
    pointer.y = v.y;
    const w = camera.toWorld(v.x, v.y);
    worldPointer.x = w.x;
    worldPointer.y = w.y;

    pointer.inside =
      v.inside &&
      sawPointer &&
      !document.hidden &&
      !modalOpen &&
      tray === 'none' &&
      !hamster.held &&
      dragIndex < 0 &&
      !dragNew;

    const dk = toDesk(v.x, v.y);
    hoverNotebook = v.inside && journalCount > 0 && notebookHit(dk.x, dk.y);
    hoverJar = v.inside && hit(jarRect(), dk.x, dk.y);
    hoverCrate = v.inside && hit(crateRect(), dk.x, dk.y);
    hoverGift = v.inside && hit(giftRect(), dk.x, dk.y);
    hoverCarrier = v.inside && hit(carrierRect(), dk.x, dk.y);
    trayHover =
      tray === 'food'
        ? foodTrayIndex(v.x, v.y)
        : tray === 'shelf'
          ? shelfTrayIndex(v.x, v.y)
          : tray === 'substrate'
            ? substrateTrayIndex(v.x, v.y)
            : -1;

    /**
     * ★ 길게 누르기가 익는 곳.
     *
     * setTimeout이 아니라 루프에서 센다. 타이머로 하면 차오르는 표시와
     * 실제 발동 시점이 따로 놀아서, 다 찬 것처럼 보이는데 아직 안 되거나
     * 그 반대가 된다. 눈에 보이는 것과 실제가 어긋나면 고장 난 걸로 읽힌다.
     */
    if (pending) {
      const moved = Math.hypot(v.x - pending.vx, v.y - pending.vy);
      holdT = clamp((now - pending.t0) / HOLD_MS, 0, 1);
      // 시간이 다 찼거나, 확실히 끌기 시작했거나. 둘 중 하나면 집는다.
      if (holdT >= 1 || moved > DRAG_GRAB) {
        const p = pending;
        clearPending();
        buzz(14); // 손끝으로 "잡혔다"고 대답한다
        if (p.kind === 'hamster') grabHamster(now);
        else grabFurniture(p.index, w.x);
      }
    }

    // 놓는 자리는 가구를 들고 있을 때만 뜬다 (햄스터는 갈 데가 없다)
    const wantDrop = dragIndex >= 0 || dragNew !== null;
    dropT = clamp(dropT + (wantDrop ? dt * 6 : -dt * 9), 0, 1);

    if (dragIndex >= 0) {
      // 손이 이만큼 움직였으면 '옮기는 중'이다. 그 아래는 톡 누른 것으로 친다.
      const f0 = hab.furniture[dragIndex];
      if (!dragMoved && f0 && dragOrigin) {
        const want = w.x - dragOffset - originX(f0.cx);
        if (Math.abs(want - dragOrigin.x) > 3) dragMoved = true;
      }
      const cell = cellOfPoint(hab, w.x, w.y);
      if (dragMoved && cell) {
        const f1 = hab.furniture[dragIndex]!;
        if (FURNITURE[f1.id].mount === 'wall') {
          // 벽에 거는 물건은 끌고 다녀도 두 자리 중 하나로만 간다
          const s = hab.snapToWall(f1.id, w.x);
          hab.move(dragIndex, s.cell, s.x, 0);
        } else {
          hab.move(dragIndex, cell, w.x - dragOffset - originX(cell.cx), liftFor(f1.id, w));
        }
      }
    }

    const moved = Math.hypot(v.x - prevX, v.y - prevY);
    prevX = v.x;
    prevY = v.y;
    pointer.speed = lerp(pointer.speed, moved / dt, 0.4);
    pointer.still = pointer.speed < 6 ? pointer.still + dt : 0;

    if (pointer.inside) {
      if (outsideFor > 20) pendingNotice = true;
      outsideFor = 0;
    } else {
      outsideFor += dt;
    }

    updateSpin(dt);
    if (reveal) reveal.t += dt;
    // 커서가 빠르게 움직일수록 들린 물건이 뒤로 기운다
    if (dragNew || dragIndex >= 0) {
      const vx = (worldPointer.x - prevCarryX) / Math.max(dt, 0.001);
      carryTilt = lerp(carryTilt, clamp(-vx * 0.0022, -0.3, 0.3), 0.18);
    } else carryTilt = 0;
    prevCarryX = worldPointer.x;
    if (toast && (toast.t += dt) > 2.2) toast = null;

    ctx.now = now;
    ctx.dt = dt;
    ctx.present = presence.active;
    ctx.ground = hamster.floorY;
    sfx.setCalm(hamster.asleep);

    if (now >= nextStatsAt) {
      nextStatsAt = now + 500;
      ctx.familiarity = log.familiarity();
      ctx.petCount = log.count('pet.accepted');
    }

    if (pendingNotice && presence.active && !hamster.asleep) {
      triggerNotice(hamster, ctx);
      pendingNotice = false;
    }

    graph = buildGraph(hab);
    ctx.graph = graph;
    syncVisitors(now);
    syncCompanions(now);
    updateHamster(hamster, ctx);
    if (DEMO_MODE) {
      const g = window as unknown as Record<string, unknown>;
      g.__ham = hamster;
      g.__graph = graph;
      g.__hab = hab;
      g.__viewW = VIEW_W;
      g.__viewH = VIEW_H;
      // 테스트가 화면 어디를 눌러야 하는지 알 수 있게 (데모에서만)
      g.__cam = (wx: number, wy: number) => {
        const r = canvas.getBoundingClientRect();
        const k = r.width / VIEW_W;
        const v = camera.toView(wx, wy);
        return { x: r.left + v.x * k, y: r.top + v.y * k };
      };
    }
    for (const g of visitors) updateHamster(g, ctx);
    for (const g of companions.values()) updateHamster(g, ctx);

    if (now >= nextCatchUpAt) {
      nextCatchUpAt = now + 60_000;
      if (journal.catchUp(now) > 0) refreshJournalCache();
    }
    if (now >= nextDerivedAt) {
      nextDerivedAt = now + 60_000;
      recomputeDerived(now);
    }

    log.flush(now);
  },

  render(now) {
    screen.beginFrame();
    const c = screen.ctx;

    camera.apply(c);
    const range = camera.viewRange();

    // 데모에서만 시각을 밀어볼 수 있다 — 시계·창밖·색온도를 눈으로 확인하려고.
    // 배경까지 같이 밀어야 확인이 되는데, 예전엔 색온도만 밀려서
    // 새벽 화면을 찍어도 창밖은 그대로 낮이었다.
    const shift = DEMO_MODE
      ? ((window as unknown as Record<string, number>).__hourShift ?? 0) * 3600_000
      : 0;
    const shown = now + shift;

    // ① 방 — 벽, 창문, 소품. 집이 닿은 구간만 불이 켜져 있다.
    const backdropCtx = {
      season: ctx.season,
      weather: ctx.weather,
      sky: skyColor(ctx.season, ctx.weather),
      time: shown,
      lampWarmth: lampWarmthAt(shown),
    };
    drawBackdrop(c, hab, range, backdropCtx, log.seed);
    drawDeskSurface(c, range, hab, backdropCtx);

    // ② 사육장
    drawHabitatBack(c, hab, now);
    drawStash(c, hab);
    // 들고 있는 건 줄에서 빼고 손에 그린다 (아래 dragIndex 블록에서)
    drawFurniture(c, hab, now, dragIndex, (i) => spin.get(i) ?? 0);
    drawBowlFood(c, hab, hab.bowlFood);
    for (const g of visitors) drawHamster(c, g);
    for (const g of companions.values()) drawHamster(c, g);
    // 들고 있을 땐 내려놓을 자리에 그림자를 미리 깔아준다.
    // 이게 없으면 어디에 떨어질지 모르는 채로 손을 놓게 된다.
    if (hamster.held || hamster.falling) drawDropShadow(c, hamster.wx);
    drawInBurrow(c, hamster, now);
    // 이미 놓인 것을 옮기는 중 — 새로 놓을 때와 똑같이 들고 있는 것으로 그린다
    if (dragIndex >= 0) {
      const f = hab.furniture[dragIndex];
      if (f) {
        const cell = cellOfPoint(hab, worldPointer.x, worldPointer.y);
        if (cell) drawDropGhost(c, f.id, originX(f.cx) + f.x, groundY(f.cy) - (f.lift ?? 0));
        // 손에 든 것은 아래(④)에서 전부의 위에 그린다
      }
    }
    /**
     * 들고 있는 물건 — 놓일 자리를 먼저 보여주고, 그 위에 손에 든 걸 그린다.
     * 자리는 사육장 좌표계 안에, 손은 그 위에. 순서가 곧 높이다.
     */
    if (dragNew) {
      const cell = cellOfPoint(hab, worldPointer.x, worldPointer.y);
      const def = FURNITURE[dragNew];
      if (cell) {
        const gx = clamp(
          worldPointer.x - def.w / 2,
          originX(cell.cx) - def.w / 2,
          originX(cell.cx) + MODULE_W - def.w / 2,
        );
        drawDropGhost(c, dragNew, gx, groundY(cell.cy) - liftFor(dragNew, worldPointer));
      }
    }
    // 러닝휠 앞테처럼 햄스터를 가로질러야 하는 부분
    drawFurnitureFront(c, hab, now, dragIndex, (i) => spin.get(i) ?? 0);
    drawHabitatFront(c, hab);
    camera.release(c);

    // ③ 마감 — 결과 비네트. 방까지만 덮고 내 물건 위로는 안 올린다.
    drawSeasonTint(c, ctx.season, ctx.weather);
    drawTemperature(c, VIEW_W, VIEW_H, shown);
    drawDust(c, VIEW_W, VIEW_H, now);
    drawGrain(c, VIEW_W, VIEW_H);
    drawVignette(c, VIEW_W, VIEW_H);

    // ④ 내 물건 (화면 고정). 다섯 개를 한 묶음으로 키운다 — applyDeskScale 참고.
    drawForeground(c);
    c.save();
    applyDeskScale(c);
    if (journalCount > 0) {
      drawNotebook(c, { hover: hoverNotebook, unread: journalUnread > 0, time: now });
    }
    drawCarrier(c, hoverCarrier, hab.hamsters.size - hab.active.length);
    drawGift(c, hoverGift, now, giftProgress(hab, now));
    drawJar(c, hoverJar, log.count('food.given') === 0, now);
    drawCrate(c, hoverCrate, hab.unlocked.size > newSince || neverOpenedCrate, now, willReturn());
    if (toast) drawToast(c, toast.text, toast.t);
    c.restore();


    if (tray === 'food') {
      drawFoodTray(c, trayHover, hab.foods);
      if (trayHover >= 0) drawFoodLabel(c, FOOD_IDS[trayHover]!, hab.foods);
    } else if (tray === 'shelf') {
      drawShelfTray(c, trayHover, hab.unlocked, hab.placedIds(), (id) => hab.canPlace(id));
      if (trayHover >= 0) drawFurnitureLabel(c, FURNITURE_IDS[trayHover]!, hab.unlocked);
    } else if (tray === 'hamster') {
      drawHamsterTray(c, trayHover, hab.hamsters, hab.active);
      if (trayHover >= 0) drawHamsterLabel(c, BREED_IDS[trayHover]!, hab.hamsters, hab.active);
    } else if (tray === 'substrate') {
      drawSubstrateTray(c, trayHover);
      if (trayHover >= 0) drawSubstrateLabel(c, trayHover);
    }

    /**
     * 놓는 자리 — 쟁반보다는 위, 소포보다는 아래.
     * 물건을 들고 있을 때만 나타난다. 늘 떠 있으면 방에 붙은 버튼이 되고,
     * 이 게임에서 화면에 상주하는 버튼은 책상 위 다섯 개로 충분하다.
     */
    if (dropT > 0.01) {
      drawDropZone(
        c,
        'crate',
        dropT,
        overCrate(pointer.x, pointer.y, worldPointer.x, worldPointer.y),
      );
    }

    /**
     * ★ 손에 든 물건은 전부의 위에. 놓는 자리보다도 위다.
     *
     * 예전엔 사육장과 같은 층에 그렸다. 그러면 상자에 넣으려고 아래로
     * 내리는 순간 책상 뒤로 숨어서 **손에서 사라졌다.** 뭘 들고 있었는지
     * 놓치고, 어디에 떨어뜨리는지도 모르게 된다.
     *
     * 놓는 자리(상자)는 책상에 놓인 자리고 손은 그 위를 지나간다.
     * 순서가 곧 높이다 — 알약을 나중에 그리면 손에 든 게 알약 뒤로 숨는다.
     *
     * 좌표는 그대로 월드다. 카메라만 다시 걸어준다 — 그래야 방 안에 있을
     * 때 크기와 자리가 어긋나지 않는다.
     */
    if (dragIndex >= 0 || dragNew) {
      c.save();
      camera.apply(c);
      const id = dragNew ?? hab.furniture[dragIndex]?.id;
      if (id) drawCarried(c, id, worldPointer.x, worldPointer.y, carryTilt, now);
      camera.release(c);
      c.restore();
    }

    // 소포 결과는 전부의 위에 — 잠깐 이것만 보라는 뜻이다
    if (reveal) drawReveal(c, reveal);

    if (holdT > 0) drawHoldRing(c);
    drawTouch(c);
    if (debug) drawDebug(c);
    screen.present();
  },
});

/**
 * 길게 누르는 동안 손가락 둘레에 차오르는 고리.
 *
 * 이게 없으면 길게 누르기는 그냥 '안 되는 조작'이다 — 얼마나 눌러야
 * 하는지 알 길이 없으니 손을 떼버린다. 진행이 보여야 기다린다.
 */
function drawHoldRing(c: CanvasRenderingContext2D): void {
  const v = screen.toView(clientX, clientY);
  if (!v.inside) return;
  const r = 16;
  c.save();
  c.translate(v.x, v.y);

  c.strokeStyle = 'rgba(255,226,186,0.22)';
  c.lineWidth = 2.5;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.stroke();

  // 12시부터 시계방향으로 찬다
  c.strokeStyle = 'rgba(255,214,150,0.95)';
  c.lineWidth = 2.5;
  c.lineCap = 'round';
  c.beginPath();
  c.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * holdT);
  c.stroke();
  c.restore();
}

function drawTouch(c: CanvasRenderingContext2D): void {
  const v = screen.toView(clientX, clientY);
  if (!v.inside || !sawPointer) return;
  const glow = hamster.petting ? 1 : 0.45;
  c.globalAlpha = 0.5 * glow;
  c.fillStyle = P.touch;
  c.beginPath();
  c.arc(v.x, v.y, hamster.petting ? 5.5 : 3.5, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
  c.fillStyle = P.touch;
  c.fillRect(Math.round(v.x) - 1, Math.round(v.y) - 1, 2, 2);
}

function drawDebug(c: CanvasRenderingContext2D): void {
  const h = hamster;
  const lines = [
    `${h.action}${h.asleep ? '(zZ)' : ''} floor ${h.floorId}`,
    `en${bar(h.energy)} cu${bar(h.curiosity)} co${bar(h.comfort)}`,
    `at${bar(h.attention)} hu${bar(h.hunger)} 볼${bar(h.cheek)}`,
    `가구 ${hab.furniture.length} 바닥 ${graph.floors.length}`,
    `창고 ${hab.stashCell ? `${hab.stashCell.cx},${hab.stashCell.cy}` : '-'} x${hab.stashTotal()}`,
    `최애 ${prefs.favoriteFood ?? '-'} 자리 ${prefs.favoriteSpot ?? '-'}`,
    `동조 ${entrainment.strength.toFixed(2)} ${ctx.season}/${ctx.weather} D${dayNumber(ctx.now)}`,
    `일기 ${journalCount} view ${VIEW_W}x${VIEW_H} ${log.name ?? ''}`,
  ];
  c.fillStyle = 'rgba(0,0,0,0.6)';
  c.fillRect(0, 0, 156, lines.length * 8 + 4);
  c.fillStyle = '#e8ffe0';
  c.font = '7px monospace';
  c.textBaseline = 'top';
  lines.forEach((l, idx) => c.fillText(l, 3, 3 + idx * 8));
  c.textBaseline = 'alphabetic';
}

const bar = (v: number): string => '█'.repeat(Math.round(clamp(v, 0, 1) * 5)).padEnd(5, '·');
