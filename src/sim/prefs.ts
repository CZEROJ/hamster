import { FOOD_IDS, type FoodId } from '../content/foods';
import type { FurnitureId } from '../content/furniture';
import type { EventLog } from '../core/log';
import type { Weather } from './season';

/**
 * ★ 취향 형성.
 *
 * 이 파일이 기획서에서 제가 뒤집은 가장 큰 부분이다.
 *
 * 원래 안: 시작할 때 '좋아하는 음식'을 랜덤으로 정해두고 숨긴다.
 *   → 두 가지로만 끝난다. 끝까지 못 찾거나(안 보이는 콘텐츠),
 *     전부 먹여보고 정답을 맞히거나(퍼즐).  둘 다 성격이 아니다.
 *
 * 바꾼 안: 취향은 '실제로 무슨 일이 있었는가'에서 자란다.
 *   비 오는 날 딸기를 세 번 줬고 세 번 다 잘 먹었으면 딸기가 최애가 된다.
 *   그러면 최애에 사연이 생긴다. `food_pref: strawberry`는 수치지만
 *   "비 오는 날 같이 먹어서 좋아하게 됐다"는 기억이다.
 *
 * 그리고 취향은 절대 숫자로 표시되지 않는다. 행동과 일기로만 드러난다.
 */

/** 최애로 인정하려면 이만큼은 쌓여야 한다. 한 번 먹고 최애가 되면 가볍다. */
const MIN_EVIDENCE = 3;
/** 2등보다 이만큼은 앞서야 한다. 아니면 '아직 모르겠다'가 정직하다. */
const MARGIN = 1.4;

export interface Prefs {
  favoriteFood: FoodId | null;
  foodScores: Record<string, number>;
  triedFoods: Set<string>;
  favoriteSpot: FurnitureId | null;
  spotScores: Record<string, number>;
  favoriteWeather: Weather | null;
  /** 0..1 — 취향이 얼마나 확립됐는가. 일기 문장 선택에 쓴다. */
  confidence: number;
}

export function computePrefs(log: EventLog, seed: number): Prefs {
  const foodScores: Record<string, number> = {};
  const spotScores: Record<string, number> = {};
  const weatherScores: Record<string, number> = {};
  const tried = new Set<string>();

  // 아주 작은 선천적 편향. 완전히 균일하면 동점이 계속 나서 취향이 안 생긴다.
  // 어디까지나 동점을 깨는 용도 — 실제 무게는 그녀가 한 일이 만든다.
  for (let i = 0; i < FOOD_IDS.length; i++) {
    foodScores[FOOD_IDS[i]!] = ((((seed >>> (i * 3)) & 7) / 7) * 0.6);
  }

  for (const e of log.all()) {
    if (e.type === 'food.eaten') {
      const f = String(e.data?.food ?? '');
      if (!f) continue;
      tried.add(f);
      foodScores[f] = (foodScores[f] ?? 0) + 1;
      const w = String(e.data?.weather ?? '');
      if (w) weatherScores[w] = (weatherScores[w] ?? 0) + 0.5;
    } else if (e.type === 'food.ignored') {
      const f = String(e.data?.food ?? '');
      if (f) {
        tried.add(f);
        foodScores[f] = (foodScores[f] ?? 0) - 0.35;
      }
    } else if (e.type === 'furniture.used') {
      const id = String(e.data?.id ?? '');
      const act = String(e.data?.action ?? '');
      if (!id) continue;
      // 잠자리는 다른 행동보다 훨씬 강한 선호 신호다. 어디서 자느냐가 그 방의 답이다.
      spotScores[id] = (spotScores[id] ?? 0) + (act === 'sleep' ? 1 : 0.25);
    }
  }

  const food = pickTop(foodScores);
  const spot = pickTop(spotScores);
  const weather = pickTop(weatherScores);

  return {
    favoriteFood: (food.id as FoodId | null) ?? null,
    foodScores,
    triedFoods: tried,
    favoriteSpot: (spot.id as FurnitureId | null) ?? null,
    spotScores,
    favoriteWeather: (weather.id as Weather | null) ?? null,
    confidence: Math.min(1, food.strength),
  };
}

function pickTop(scores: Record<string, number>): { id: string | null; strength: number } {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const first = sorted[0];
  const second = sorted[1];
  if (!first || first[1] < MIN_EVIDENCE) return { id: null, strength: 0 };
  if (second && first[1] < second[1] * MARGIN) return { id: null, strength: 0.4 };
  return { id: first[0], strength: Math.min(1, first[1] / (MIN_EVIDENCE * 2.5)) };
}

/**
 * 이 음식을 먹을 확률.
 * 처음 보는 건 무조건 궁금하고(신기함), 아는 건 취향대로 간다.
 * 어떤 경우에도 0이 되지 않는다 — 절대 안 먹는 음식이 있으면 그건 벽이다.
 */
export function appetiteFor(prefs: Prefs, food: FoodId, hunger: number): number {
  if (!prefs.triedFoods.has(food)) return 0.9; // 새로운 건 일단 궁금하다
  const s = prefs.foodScores[food] ?? 0;
  const best = Math.max(1, ...Object.values(prefs.foodScores));
  return Math.min(0.95, 0.28 + (s / best) * 0.5 + hunger * 0.25);
}
