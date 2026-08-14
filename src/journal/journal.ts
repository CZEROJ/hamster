import { COATS, type BreedId } from '../content/breeds';
import { FOODS, type FoodId } from '../content/foods';
import { FURNITURE, type FurnitureId } from '../content/furniture';
import { LETTERS, type LetterCtx } from '../content/letters';
import { fill } from '../core/kr';
import type { EventLog, GameEvent } from '../core/log';
import { createRng } from '../core/rng';
import { seasonOf, weatherOf } from '../sim/season';
import { dayEnd, dayKeyOf, dayStart, extractFacts, type DayContext } from './facts';
import { herWord, TAILS, TEMPLATES } from './templates';

/**
 * 일기 생성.
 *
 * ★ 가장 중요한 규칙: 한 번 쓰인 일기는 영원히 안 바뀐다.
 *   다시 읽을 때 문장이 달라지면 그건 기억이 아니라 랜덤 생성기다.
 *   그래서 생성 즉시 이벤트 로그에 박아 넣는다. 일기도 기억의 일부가 된다.
 *
 * 두 번째 규칙: 아무도 안 온 날은 아예 쓰지 않는다.
 *   30일 비웠다고 30페이지를 채우면 공책이 공허해진다.
 *   대신 다시 왔을 때 "며칠 동안 조용했다"로 한 번에 처리한다.
 */

export interface JournalEntry {
  day: string;
  text: string;
  authored: boolean;
  t: number;
}

/** 최근 이만큼의 일기 안에서는 같은 문장을 다시 쓰지 않는다 */
const NO_REPEAT_WINDOW = 14;

const READ_KEY = 'hamster.journalRead.v1';

export class Journal {
  constructor(private readonly log: EventLog) {}

  entries(): JournalEntry[] {
    return this.log
      .ofType('journal.entry')
      .map((e) => ({
        day: String(e.data?.day ?? ''),
        text: String(e.data?.text ?? ''),
        authored: e.data?.authored === true,
        t: e.t,
      }))
      .sort((a, b) => (a.day === b.day ? a.t - b.t : a.day < b.day ? -1 : 1));
  }

  /** 아직 안 읽은 일기 수 — 공책이 조용히 빛나는 근거 */
  unreadCount(): number {
    const lastRead = localStorage.getItem(READ_KEY) ?? '';
    return this.entries().filter((e) => e.day > lastRead).length;
  }

  markRead(): void {
    const all = this.entries();
    const last = all[all.length - 1];
    if (last) localStorage.setItem(READ_KEY, last.day);
  }

  /**
   * 아직 쓰이지 않은 지난 날들을 채운다. 부팅 시 한 번, 그리고 하루가 넘어갈 때.
   * @returns 새로 쓰인 편수
   */
  catchUp(now: number): number {
    const existing = new Set(this.entries().map((e) => e.day));
    const today = dayKeyOf(now);
    const all = this.log.all();

    // 세션이 있었던 날짜 집합 — '조용한 날'을 건너뛰고 공백을 세는 데 쓴다
    const visitedDays = new Set<string>();
    for (const e of all) {
      if (e.type === 'session.start') visitedDays.add(dayKeyOf(e.t));
    }

    const startKey = dayKeyOf(this.log.createdAt);
    let written = 0;
    let cursor = startKey;
    let prevVisit: string | null = null;
    let guard = 0;

    while (cursor < today && guard++ < 800) {
      const isVisited = visitedDays.has(cursor);

      if (isVisited && !existing.has(cursor)) {
        const text = this.compose(cursor, all, prevVisit, startKey);
        if (text) {
          this.log.append(dayEnd(cursor) - 1, 'journal.entry', {
            day: cursor,
            text: text.text,
            tpl: text.tpl,
          });
          written++;
        }
      }
      if (isVisited) prevVisit = cursor;
      cursor = nextDay(cursor);
    }

    written += this.fireLetters(now, today, startKey);
    return written;
  }

  // ────────────────────────────────────────────────────────────

  private compose(
    day: string,
    all: readonly GameEvent[],
    prevVisit: string | null,
    startKey: string,
  ): { text: string; tpl: string } | null {
    const t0 = dayStart(day);
    const t1 = dayEnd(day);
    const events = all.filter((e) => e.t >= t0 && e.t < t1);

    const before = all.filter((e) => e.t < t0);

    // ★ 그날 시점의 취향으로 판단한다. 지금의 취향으로 과거를 다시 쓰면 그건 기억이 아니다.
    const foodCount: Record<string, number> = {};
    const known = new Set<string>();
    for (const e of before) {
      if (e.type !== 'food.eaten') continue;
      const f = String(e.data?.food ?? '');
      if (!f) continue;
      known.add(f);
      foodCount[f] = (foodCount[f] ?? 0) + 1;
    }
    const ranked = Object.entries(foodCount).sort((a, b) => b[1] - a[1]);
    const favoriteFood =
      ranked[0] && ranked[0][1] >= 3 && (!ranked[1] || ranked[0][1] >= ranked[1][1] * 1.4)
        ? ranked[0][0]
        : null;

    const ctx: DayContext = {
      everPetted: before.some((e) => e.type === 'pet.accepted'),
      everApproached: before.some((e) => e.type === 'hamster.approached'),
      dayNumber: daysBetween(startKey, day) + 1,
      gapDays: prevVisit ? daysBetween(prevVisit, day) : 0,
      favoriteFood,
      knownFoods: known,
      weather: weatherOf(t0, this.log.seed),
      season: seasonOf(t0),
      foodName: (id) => FOODS[id as FoodId]?.name ?? '뭔가',
      furnitureName: (id) => FURNITURE[id as FurnitureId]?.name ?? '뭔가',
      breedName: (id) => COATS[id as BreedId]?.name ?? '낯선 애',
    };

    const facts = extractFacts(events, ctx);
    const rng = createRng(hash(day) ^ this.log.seed);
    const recent = this.recentTemplateIds();

    // 현저성 순으로 훑으면서, 최근에 안 쓴 문장이 있는 사실을 고른다.
    for (const fact of facts) {
      const bank = TEMPLATES[fact.kind];
      if (!bank || bank.length === 0) continue;

      const fresh = bank.filter((t) => !recent.has(t.id));
      const pool = fresh.length > 0 ? fresh : bank;
      const tpl = pool[Math.floor(rng.next() * pool.length)]!;

      const vars = { her: herWord(ctx.dayNumber), ...(fact.vars ?? {}) };
      let text = fill(tpl.text, vars);

      // 가끔만 꼬리 문장을 붙인다. 매번 붙으면 리듬이 죽는다.
      const tails = TAILS[fact.kind];
      if (tails && tails.length > 0 && rng.chance(0.3)) {
        text += '\n' + tails[Math.floor(rng.next() * tails.length)]!;
      }

      return { text, tpl: tpl.id };
    }
    return null;
  }

  private recentTemplateIds(): Set<string> {
    const evs = this.log.ofType('journal.entry');
    const ids = new Set<string>();
    for (const e of evs.slice(-NO_REPEAT_WINDOW)) {
      const id = e.data?.tpl;
      if (typeof id === 'string') ids.add(id);
    }
    return ids;
  }

  /** 형이 심어둔 편지들 — 조건이 맞으면 오늘 자로 끼어든다 */
  private fireLetters(now: number, today: string, startKey: string): number {
    const fired = new Set(
      this.log
        .ofType('journal.entry')
        .map((e) => e.data?.letter)
        .filter((v): v is string => typeof v === 'string'),
    );

    const d = new Date(now);
    const ctx: LetterCtx = {
      dayNumber: daysBetween(startKey, today) + 1,
      dayKey: today,
      month: d.getMonth() + 1,
      date: d.getDate(),
      petTotal: this.log.count('pet.accepted'),
      sessionTotal: this.log.count('session.start'),
    };

    let n = 0;
    for (const letter of LETTERS) {
      if (fired.has(letter.id)) continue;
      let ok = false;
      try {
        ok = letter.when(ctx);
      } catch {
        ok = false; // 조건식이 터져도 게임은 계속 돌아야 한다
      }
      if (!ok) continue;
      this.log.append(now, 'journal.entry', {
        day: today,
        text: letter.text,
        authored: true,
        letter: letter.id,
      });
      n++;
    }
    return n;
  }
}

// ── 날짜 유틸 ────────────────────────────────────────────────

function nextDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  const ta = new Date(pa[0]!, pa[1]! - 1, pa[2]!).getTime();
  const tb = new Date(pb[0]!, pb[1]! - 1, pb[2]!).getTime();
  return Math.round((tb - ta) / 86_400_000);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
