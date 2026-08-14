import type { Rng } from '../core/rng';
import type { EventData, EventType } from '../core/log';
import type { Affordance } from '../content/furniture';
import type { FloorGraph, FloorId } from './floors';
import type { Habitat } from './habitat';
import type { Prefs } from './prefs';
import type { Season, Weather } from './season';

export type ActionId =
  | 'idle'
  | 'wander'
  | 'sniff'
  | 'groom'
  | 'standLook'
  | 'burrow'
  | 'sleep'
  | 'approach'
  | 'stretch'
  | 'zoomie'
  | 'flop'
  | 'useSpot'
  | 'eat'
  | 'wallScratch'
  | 'stash'
  | 'greet'
  | 'avoid'
  | 'explore';

/** '알아차리는 순간'의 5박자. 1번(delay)이 이 게임에서 가장 중요한 0.5초다. */
export type NoticePhase = 'none' | 'delay' | 'freeze' | 'turn' | 'stand' | 'settle';

export type SoundId =
  | 'step'
  | 'rustle'
  | 'sniff'
  | 'groom'
  | 'wake'
  | 'settle'
  | 'squeak'
  | 'flinch';

export interface Pointer {
  x: number;
  y: number;
  inside: boolean;
  /** 뷰 픽셀/초 */
  speed: number;
  /** 거의 멈춰 있던 시간(초) */
  still: number;
}

export interface WorldCtx {
  now: number;
  dt: number;
  rng: Rng;
  ground: number;
  minX: number;
  maxX: number;
  pointer: Pointer;
  present: boolean;
  /** 함께한 세션 수에서 파생. 숫자로는 절대 보이지 않는다. */
  familiarity: number;
  /** 지금까지 쓰다듬기가 성공한 횟수. 처음 몇 번은 반드시 성공시킨다. */
  petCount: number;
  /** 동조로 학습된 24칸 각성 곡선. 그녀의 생활 리듬이 여기 들어 있다. */
  wakeCurve: readonly number[];
  hab: Habitat;
  /** 기록에서 자란 취향. 미리 정해진 값이 아니다. */
  prefs: Prefs;
  season: Season;
  weather: Weather;
  /** 바닥·연결 그래프 (배치가 바뀔 때만 다시 만든다) */
  graph: FloorGraph;
  /** 오늘 잘 자리 */
  bed: { floorId: FloorId; x: number };
  /** 지금 와 있는 손님들. 내 햄스터가 반응할 대상이다. */
  visitors: Hamster[];
  /** 이 품종을 좋아하는가 (-1..1). 선천적 성향 + 겪은 횟수. */
  guestFeeling(breed: import('../content/breeds').BreedId): number;
  /** 포인터가 가리키는 월드 좌표 (카메라 역변환 결과) */
  worldPointer: { x: number; y: number };
  emit(type: EventType, data?: EventData): void;
  /** 시뮬은 소리를 '요청'만 한다. 소리가 시뮬로 되먹임되지 않는다. */
  sound(id: SoundId, gain?: number): void;
}

/** 관·사다리를 지나가는 동안의 상태 */
export interface Travel {
  /** 이어 붙인 월드 좌표 경유점들 */
  pts: { x: number; y: number }[];
  i: number;
  /** 현재 구간에서 얼마나 왔는가 (0..1) */
  t: number;
  /** 도착할 바닥 */
  floorId: FloorId;
  /** 도착할 월드 x */
  x: number;
}

export interface Hamster {
  // ── 정체 ──────────────────────────────────────
  /** 털색. 내 햄스터는 항상 golden. */
  breed: import('../content/breeds').BreedId;
  /**
   * 손님인가. 손님은 이름도 일기도 없고 쓰다듬을 수도 없다.
   * 가족이 아니라 날씨다 — 왔다가 간다.
   */
  isVisitor: boolean;
  /** 손님이 떠나는 시각 (epoch ms) */
  leaveAt: number;

  // ── 위치 / 이동 ────────────────────────────────
  /**
   * ★ 위치는 '어느 방의 몇 번째 칸'이 아니라 '어느 바닥 선분 위의 월드 x'다.
   *   칸이 붙어서 합쳐지면 방이라는 단위 자체가 사라지기 때문에,
   *   걸어 다닐 수 있는 선분을 기준으로 잡는다.
   */
  floorId: FloorId;
  /** 월드 x (이게 위치의 원본이다) */
  wx: number;
  /** 지금 서 있는 바닥의 높이 (매 틱 갱신) */
  floorY: number;
  floorX0: number;
  floorX1: number;
  /** 렌더러가 읽는 월드 좌표 */
  wy: number;
  vx: number;
  facing: 1 | -1;
  /** 같은 바닥 안에서의 목표 월드 x */
  moveTarget: number | null;
  /** 관·사다리를 타는 중이면 여기에 경로가 있다 */
  travel: Travel | null;
  /** 목적지 (다른 바닥일 수도 있다) */
  goal: { floorId: FloorId; x: number } | null;
  /** 버스트-정지 이동 */
  burst: number;
  burstPause: number;
  landSquash: number;
  /** 손에 들려 있다 */
  held: boolean;
  /** 들린 정도 0~1. 툭 튀지 않게 사이를 채운다. */
  heldT: number;
  /** 손에서 놓여 떨어지는 중 */
  falling: boolean;
  /** 낙하 속도 (월드 px/초) */
  fallVy: number;
  /** 떨어지며 허둥대는 정도 0~1 */
  flail: number;

  // ── 충동 (0..1) ───────────────────────────────
  // 절대 화면에 표시하지 않는다. 절대 0이 되어 고통을 만들지 않는다.
  // '욕구(need)'가 아니라 '지금 하고 싶은 것'이다. 이 차이가 타마고치와 이 게임을 가른다.
  energy: number;
  curiosity: number;
  comfort: number;
  attention: number;

  // ── 상태 ──────────────────────────────────────
  asleep: boolean;
  /** 0..1 — 잠자리로 향하는 중이면 높다 */
  sleepPressure: number;

  // ── 포즈 (시뮬이 쓰고 렌더러가 읽는다) ─────────────
  /** 라디안. 0 = 정면(플레이어를 봄), ±PI/2 = 완전 측면 */
  headYaw: number;
  headYawVel: number;
  headPitch: number;
  stand: number;
  standTarget: number;
  standVel: number;
  curl: number;
  /**
   * ★ 납작 (0..1) — stand·curl과 같은 층위의 세 번째 자세 축.
   *
   * 몸을 바닥에 쫙 펴고 늘어진 자세. 진짜 햄스터가 이러는 건 완전히 안전할
   * 때뿐이라, 이건 스탯이 아니라 **광경**이다. 오래 함께한 사람만 본다.
   *
   * 렌더러가 action 이름을 보고 분기하지 않게 축으로 만든다. if (action ===
   * 'flop')을 렌더러에 넣기 시작하면 한 주 안에 분기가 여덟 개가 되고
   * 자세가 바뀔 때마다 툭툭 튄다.
   */
  flat: number;
  flatTarget: number;
  /**
   * ★ 굴 파고 들어간 정도 (0..1) — 네 번째 자세 축.
   *
   * 0이면 톱밥 위, 1이면 굴 바닥까지 내려간 상태. 이 값만큼 몸이 톱밥 선
   * 아래로 내려가고, 렌더러는 굴 밖으로 나온 부분을 잘라낸다.
   */
  dig: number;
  digTarget: number;
  /** 지금 파고 있는(또는 들어가려는) 굴의 입구 x. 없으면 null. */
  burrowX: number | null;
  /**
   * ★ 달리는 중 (0..1) — 다섯 번째 자세 축.
   *
   * 러닝휠 안에서 쓴다. 바퀴만 돌고 햄스터는 가만히 서 있으면 바퀴가
   * 저절로 도는 걸로 보인다. **다리가 움직여야 얘가 돌리는 게 된다.**
   */
  run: number;
  runTarget: number;
  /** 다리가 오가는 위상. 발과 몸통 들썩임이 같은 시계를 본다. */
  runPhase: number;
  breath: number;
  earPerk: number;
  earTwitch: number;
  earTwitchVel: number;
  /** 볼주머니. 먹이를 물면 부푼다 — 이 게임에서 제일 귀여운 실루엣. */
  cheek: number;
  eyeOpenBase: number;
  eyeOpen: number;
  blinkIn: number;
  noseWiggle: number;
  groomPhase: number;

  // ── 행동 ──────────────────────────────────────
  action: ActionId;
  actionT: number;
  actionDur: number;

  // ── 가구 / 먹이 ────────────────────────────────
  /** 지금 향하고 있는 가구의 인덱스 (habitat.furniture 기준) */
  spotIndex: number;
  spotAff: Affordance | null;
  /** 0 = 가는 중, 1 = 사용 중 */
  spotPhase: 0 | 1;
  /** 0..1 — 배고픔이 아니라 '먹고 싶음'. 굶는 일은 없다. */
  hunger: number;
  /**
   * 볼주머니에 물고 있는 먹이.
   * 실제 햄스터처럼 자기 창고로 옮겨 쌓아둔다.
   * ★ 이게 '방이 여러 개인 이유'다 — 그녀가 정하지 않은 공간이 하나 생긴다.
   */
  carrying: import('../content/foods').FoodId | null;

  // ── 알아차리는 순간 ────────────────────────────
  notice: NoticePhase;
  noticeT: number;
  noticeDur: number;
  noticeCooldown: number;

  // ── 쓰다듬기 ──────────────────────────────────
  petting: boolean;
  petBout: number;
  petContact: number;
  petJudged: boolean;
  petRefuseFor: number;
  /**
   * 손가락으로 톡 건드렸다 (잠깐 남는 초).
   *
   * 원래 쓰다듬기는 '포인터를 0.28초 가만히 올려두면'으로 판정했다.
   * 마우스에는 맞지만 손가락에는 호버가 없다 — 폰에서는 이 게임에서
   * 제일 다정한 동작에 아예 닿을 수가 없었다.
   *
   * ★ 판정을 건너뛰는 게 아니라 '가만히 있었다'는 조건만 대신한다.
   *   받아줄지 튕길지는 그대로 햄스터가 정한다 —
   *   거절할 수 있어야 승낙이 의미를 갖는다.
   */
  petPoke: number;
  flinch: number;
  /**
   * 거절할 때 바로 돌아서지 않는다. 먼저 눈을 마주친다.
   * 이 0.7초가 없으면 거절이 '성격'이 아니라 '무시'로 읽힌다.
   */
  refuseLook: number;
  refuseAwayX: number;

  /**
   * 첫 만남의 낯가림(초). 이 시간 동안은 집 근처를 안 벗어나고,
   * 알아차리는 데 더 오래 걸리고, 절대 먼저 다가오지 않는다.
   * 처음부터 살갑게 굴면 '내 햄스터'가 아니라 '설정된 마스코트'가 된다.
   */
  shy: number;
}
