import type { GameEvent } from '../core/log';

/**
 * 하루치 이벤트 → '사실(fact)' 목록.
 *
 * 핵심은 걸러내기다. 그날 있었던 일을 전부 쓰면 그건 일기가 아니라 로그다.
 * 각 사실에는 현저성(salience) 점수가 붙고, 상위 1~3개만 문장이 된다.
 *
 * 우선순위: 처음 있는 일 > 희귀한 일 > 관계적인 일 > 배경
 */

export type FactKind =
  | 'firstMeeting' // 처음 만난 날
  | 'firstPet' // 처음으로 손길을 받아준 날
  | 'firstApproach' // 처음으로 제 발로 다가온 날
  | 'named' // 이름을 받은 날
  | 'wokeEarly' // 동조 — 그녀가 올 시간에 미리 깨어 있었다
  | 'rare' // 1% 순간
  | 'newRoom' // 집이 넓어진 날
  | 'newFurniture' // 방에 새 물건이 생겼다
  | 'wanted' // 뭔가를 원한다는 신호를 보냈다
  | 'wantedRoom' // 좁다고 신호를 보냈다
  | 'stashed' // 창고에 옮겨 쌓았다
  | 'guestCame' // 손님이 왔다
  | 'guestPlayed' // 손님에게 다가갔다
  | 'ateFavorite' // 제일 좋아하는 걸 먹었다
  | 'triedNew' // 처음 보는 걸 먹어봤다
  | 'refusedFood' // 안 먹었다
  | 'ate' // 그냥 먹었다
  | 'weatherDay' // 날씨가 기억에 남은 날
  | 'approached' // 다가갔다
  | 'petted' // 쓰다듬어졌다
  | 'refused' // 거절했다
  | 'startled' // 놀랐다
  | 'longVisit' // 오래 머물렀다
  | 'shortVisit' // 잠깐 왔다 갔다
  | 'returned' // 오랜만에 왔다
  | 'sleptWell' // 그냥 잘 잤다
  | 'quiet'; // 아무도 안 왔다

export interface Fact {
  kind: FactKind;
  salience: number;
  /** 템플릿 슬롯 채우기용 */
  vars?: Record<string, string>;
}

/** 하루의 경계는 자정이 아니라 새벽 5시다. 새벽 2시 세션은 '어제'에 속한다. */
export const DAY_CUTOFF_HOUR = 5;

export function dayKeyOf(t: number): string {
  const d = new Date(t);
  if (d.getHours() < DAY_CUTOFF_HOUR) d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 그 '하루'가 시작되는 실제 시각 */
export function dayStart(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!, DAY_CUTOFF_HOUR, 0, 0, 0).getTime();
}

export function dayEnd(key: string): number {
  return dayStart(key) + 86_400_000;
}

export interface DayContext {
  /** 이 날짜 이전에 이미 일어난 적 있는 일들 */
  everPetted: boolean;
  everApproached: boolean;
  /** 몇 번째 날인가 (게임 시작일 = 1) */
  dayNumber: number;
  /** 직전 방문일로부터 며칠 비었는가 */
  gapDays: number;
  /** 그날 기준으로 형성돼 있던 최애 음식 */
  favoriteFood: string | null;
  /** 그날의 날씨/계절 */
  weather: string;
  season: string;
  /** 그날 이전에 이미 먹어본 적 있는 음식들 */
  knownFoods: Set<string>;
  /** 음식 이름 사전 */
  foodName(id: string): string;
  furnitureName(id: string): string;
  breedName(id: string): string;
}

export function extractFacts(events: GameEvent[], ctx: DayContext): Fact[] {
  const n = (type: string) => events.filter((e) => e.type === type).length;

  const sessions = n('session.start');
  const facts: Fact[] = [];

  if (sessions === 0) {
    facts.push({ kind: 'quiet', salience: 1 });
    return facts;
  }

  // 총 체류 시간(분)
  let minutes = 0;
  for (const e of events) {
    if (e.type === 'session.end' && typeof e.data?.ms === 'number') {
      minutes += e.data.ms / 60000;
    }
  }

  const pets = n('pet.accepted');
  const refusals = events.filter(
    (e) => e.type === 'pet.refused' && e.data?.reason !== 'startled',
  ).length;
  const startles = events.filter(
    (e) => e.type === 'pet.refused' && e.data?.reason === 'startled',
  ).length;
  const approaches = n('hamster.approached');
  const rares = n('hamster.rare');
  const early = n('hamster.wokeEarly');

  // ── 처음 있는 일들 (가장 높은 현저성) ──────────────
  if (ctx.dayNumber === 1) facts.push({ kind: 'firstMeeting', salience: 100 });
  if (n('hamster.named') > 0) facts.push({ kind: 'named', salience: 95 });
  if (pets > 0 && !ctx.everPetted) facts.push({ kind: 'firstPet', salience: 90 });
  if (approaches > 0 && !ctx.everApproached) facts.push({ kind: 'firstApproach', salience: 85 });

  // ── 손님 ──────────────────────────────────────
  // 손님은 '내가 없을 때도 뭔가 일어났다'는 증거다. 다시 열 이유의 절반이 여기 있다.
  const came = events.find((e) => e.type === 'visitor.came');
  if (came) {
    const guest = ctx.breedName(String(came.data?.breed ?? ''));
    if (n('visitor.greeted') > 0) facts.push({ kind: 'guestPlayed', salience: 74, vars: { guest } });
    else facts.push({ kind: 'guestCame', salience: 62, vars: { guest } });
  }

  // ── 집이 넓어진 날 ─────────────────────────────
  // 가구가 하나 늘어난 것과 방이 하나 늘어난 것은 사건의 크기가 다르다.
  if (n('room.added') > 0) facts.push({ kind: 'newRoom', salience: 88 });
  if (events.some((e) => e.type === 'hamster.wants' && e.data?.id === 'room')) {
    facts.push({ kind: 'wantedRoom', salience: 68 });
  }
  const stashed = events.filter((e) => e.type === 'food.stashed');
  if (stashed.length > 0) {
    facts.push({
      kind: 'stashed',
      salience: 58,
      vars: { food: ctx.foodName(String(stashed[0]!.data?.food ?? '')) },
    });
  }

  // ── 방이 달라진 날 ─────────────────────────────
  const placed = events.find((e) => e.type === 'furniture.firstPlaced');
  if (placed) {
    facts.push({
      kind: 'newFurniture',
      salience: 78,
      vars: { thing: ctx.furnitureName(String(placed.data?.id ?? '')) },
    });
  }
  const wants = events.find((e) => e.type === 'hamster.wants');
  if (wants) facts.push({ kind: 'wanted', salience: 66 });

  // ── 먹은 것 ───────────────────────────────────
  // 취향은 여기서 문장이 된다. 숫자로는 어디에도 안 나온다.
  const eaten = events.filter((e) => e.type === 'food.eaten');
  const firstTimeFoods = new Set(
    eaten.map((e) => String(e.data?.food ?? '')).filter((f) => f && !ctx.knownFoods.has(f)),
  );
  const favEat = eaten.find((e) => ctx.favoriteFood && e.data?.food === ctx.favoriteFood);

  if (favEat) {
    facts.push({
      kind: 'ateFavorite',
      salience: 72,
      vars: { food: ctx.foodName(String(favEat.data?.food ?? '')) },
    });
  } else if (firstTimeFoods.size > 0) {
    const f = [...firstTimeFoods][0]!;
    facts.push({ kind: 'triedNew', salience: 64, vars: { food: ctx.foodName(f) } });
  } else if (eaten.length > 0) {
    facts.push({
      kind: 'ate',
      salience: 42,
      vars: { food: ctx.foodName(String(eaten[0]!.data?.food ?? '')) },
    });
  }

  const ignored = events.find((e) => e.type === 'food.ignored');
  if (ignored && eaten.length === 0) {
    facts.push({
      kind: 'refusedFood',
      salience: 40,
      vars: { food: ctx.foodName(String(ignored.data?.food ?? '')) },
    });
  }

  // ── 날씨 ──────────────────────────────────────
  if (ctx.weather === 'rain' || ctx.weather === 'snow') {
    facts.push({ kind: 'weatherDay', salience: 34, vars: { weather: ctx.weather } });
  }

  // ── 오랜만의 재회 ──────────────────────────────
  if (ctx.gapDays >= 3) {
    facts.push({ kind: 'returned', salience: 80, vars: { days: String(ctx.gapDays) } });
  }

  // ── 동조 ──────────────────────────────────────
  if (early > 0) facts.push({ kind: 'wokeEarly', salience: 70 });

  // ── 희귀 행동 ─────────────────────────────────
  if (rares > 0) facts.push({ kind: 'rare', salience: 60 });

  // ── 관계적인 일 ────────────────────────────────
  if (approaches > 0) facts.push({ kind: 'approached', salience: 45 + approaches * 2 });
  if (pets > 0) facts.push({ kind: 'petted', salience: 40 + Math.min(pets, 4) * 3 });
  if (startles > 0) facts.push({ kind: 'startled', salience: 38 });
  if (refusals > 0 && pets === 0) facts.push({ kind: 'refused', salience: 35 });

  // ── 배경 ──────────────────────────────────────
  if (minutes >= 25) facts.push({ kind: 'longVisit', salience: 30 });
  else if (minutes > 0 && minutes < 4) facts.push({ kind: 'shortVisit', salience: 20 });

  if (facts.length === 0) facts.push({ kind: 'sleptWell', salience: 5 });

  return facts.sort((a, b) => b.salience - a.salience);
}
