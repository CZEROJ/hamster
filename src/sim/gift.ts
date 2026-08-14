import { BREED_IDS, type BreedId } from '../content/breeds';
import { FOOD_IDS, type FoodId } from '../content/foods';
import { FURNITURE_IDS, type FurnitureId } from '../content/furniture';
import { createRng } from '../core/rng';
import { dayKeyOf } from '../journal/facts';
import type { Habitat } from './habitat';

/**
 * ★ 하루에 한 번 오는 소포.
 *
 * 화폐도 확률표도 등급도 없다. 하루 한 번, 아직 없는 것 중에서 하나.
 * 재화를 넣는 순간 '모으는 행위'가 생기는데, 이 프로젝트는 처음부터 그걸
 * 피했다 — "도토리를 줍는 행위에는 감정이 없다".
 *
 * ★ 결과는 그날 하루 고정이다.
 *
 * 날짜와 세이브 시드로 난수를 만든다. 그래서 마음에 안 든다고 새로고침해도
 * 같은 게 나온다. 이게 없으면 뽑기가 '원하는 게 나올 때까지 F5'가 되고,
 * 그러면 매일 오는 즐거움이 아니라 매일 하는 노동이 된다.
 *
 * 중복은 나오지 않는다. 가진 걸 또 주는 건 아무 일도 안 일어난 것과 같은데,
 * 그걸 '꽝'이라고 부르며 확률에 넣는 건 시간을 뺏는 설계다.
 */

export type GiftItem =
  | { kind: 'furniture'; id: FurnitureId }
  | { kind: 'food'; id: FoodId }
  | { kind: 'hamster'; id: BreedId };

/** 오늘 소포를 아직 안 열었는가 */
export function giftPending(hab: Habitat, now: number): boolean {
  return hab.lastGiftDay !== dayKeyOf(now) && pool(hab).length > 0;
}

/**
 * 다음 소포까지 얼마나 왔는가 (0 = 방금 열었다, 1 = 지금 열 수 있다).
 *
 * 자정에 1이 된다. 남은 시간을 숫자로 적는 대신 상자에 색이 차오르는
 * 것으로 보여주려고 있는 값이다.
 */
export function giftProgress(hab: Habitat, now: number): number {
  if (giftPending(hab, now)) return 1;
  const opened = hab.lastGiftAt || now;
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const span = next.getTime() - opened;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (now - opened) / span));
}

/** 아직 없는 것 전부 */
function pool(hab: Habitat): GiftItem[] {
  const out: GiftItem[] = [];
  for (const id of FURNITURE_IDS) {
    if (!hab.unlocked.has(id)) out.push({ kind: 'furniture', id });
  }
  for (const id of FOOD_IDS) {
    if (!hab.foods.has(id)) out.push({ kind: 'food', id });
  }
  /**
   * 햄스터는 가구·먹이보다 드물게 나와야 한다.
   *
   * 개수로만 두면 후보의 절반이 햄스터라 매일 새 친구가 온다. 그러면
   * 친구가 사건이 아니라 재고가 된다. 후보 목록에 다섯 번에 한 번꼴로만
   * 끼워 넣는다 — 등급표를 만들지 않고 빈도만 낮추는 방법이다.
   */
  const newFriends = BREED_IDS.filter((id) => !hab.hamsters.has(id));
  if (newFriends.length > 0 && out.length > 0) {
    const share = Math.max(1, Math.round(out.length / 4));
    for (let i = 0; i < Math.min(share, newFriends.length); i++) {
      out.push({ kind: 'hamster', id: newFriends[i]! });
    }
  } else {
    for (const id of newFriends) out.push({ kind: 'hamster', id });
  }
  return out;
}

/**
 * 오늘 나올 것. 열기 전에도 정해져 있다 (같은 날엔 몇 번을 물어도 같다).
 */
export function todaysGift(hab: Habitat, now: number, seed: number): GiftItem | null {
  const items = pool(hab);
  if (items.length === 0) return null;
  const rng = createRng(hash(dayKeyOf(now)) ^ ((seed + 0x9e37) >>> 0));
  return items[Math.floor(rng.next() * items.length)] ?? null;
}

/** 소포를 연다. 이미 열었으면 null. */
export function openGift(hab: Habitat, now: number, seed: number): GiftItem | null {
  if (!giftPending(hab, now)) return null;
  const item = todaysGift(hab, now, seed);
  if (!item) return null;
  hab.receive(item, dayKeyOf(now), now);
  return item;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
