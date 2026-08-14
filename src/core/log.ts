import { makeSeed } from './rng';
import {
  pickNewer,
  readIdb,
  readLocal,
  writeIdb,
  writeLocal,
  type Persisted,
} from './store';

/**
 * 이벤트 로그 = 세이브 파일 = 기억 시스템 = 일기의 원천.
 *
 * 규칙: 로그에 남길 가치가 있는가 == 일기에 쓸 가치가 있는가.
 * 배회, 세수 같은 일상 행동은 로그에 남기지 않는다. 텔레메트리가 아니라 기억이다.
 */
export type EventType =
  | 'game.created'
  | 'session.start'
  | 'session.end'
  | 'hamster.noticed' // 플레이어를 알아차림
  | 'hamster.approached' // 제 발로 다가옴
  | 'hamster.slept'
  | 'hamster.woke'
  | 'hamster.wokeEarly' // 동조 — 그녀가 올 시간에 미리 깨어 있었다
  | 'pet.accepted'
  | 'pet.refused'
  | 'hamster.rare' // 희귀 행동 (1% 순간)
  | 'absence.returned' // 오랜만에 돌아옴
  | 'hamster.named' // 이름을 받은 날
  | 'food.given'
  | 'food.eaten' // 취향이 자라는 씨앗
  | 'food.ignored'
  | 'food.stashed' // 창고에 옮겨 쌓았다
  | 'visitor.came' // 손님이 왔다
  | 'visitor.greeted' // 내 햄스터가 손님에게 다가갔다
  | 'hamster.wants' // 가구나 방을 원한다는 신호를 보냈다
  | 'hamster.held' // 손에 올려본 날 — 쓰다듬기 다음 단계의 신뢰다
  | 'furniture.unlocked'
  | 'furniture.firstPlaced' // 처음 놓은 순간만 기억한다 (옮긴 건 기억이 아니다)
  | 'furniture.used'
  | 'journal.entry'; // 일기 한 편. 한 번 쓰이면 영원히 안 바뀐다.

export type EventData = Record<string, number | string | boolean>;

export interface GameEvent {
  /** epoch ms */
  t: number;
  type: EventType;
  data?: EventData;
}

const SAVE_INTERVAL_MS = 5000;

export class EventLog {
  readonly seed: number;
  readonly createdAt: number;
  /** 마지막으로 게임이 살아있던 시각. 부재 계산과 시계 역행 방어에 쓴다. */
  lastSeenAt: number;
  /** 읽기 전용 모드(다른 탭이 이미 쓰고 있음)면 저장하지 않는다. */
  readOnly = false;

  /** 방의 배치 상태. 기억이 아니라 현재 상태라서 이벤트가 아니다. */
  layout: Record<string, unknown>;

  private events: GameEvent[];
  private dirty = false;
  private lastSaveAt = 0;

  private constructor(p: Persisted) {
    this.seed = p.seed;
    this.createdAt = p.createdAt;
    this.lastSeenAt = p.lastSeenAt ?? p.createdAt;
    this.events = p.events as GameEvent[];
    this.layout = p.layout ?? {};
  }

  touch(): void {
    this.dirty = true;
  }

  /** 이름. 없으면 아직 안 지어준 것이다. */
  get name(): string | null {
    const e = this.last('hamster.named');
    const n = e?.data?.name;
    return typeof n === 'string' && n.length > 0 ? n : null;
  }

  /**
   * localStorage와 IndexedDB를 둘 다 읽어서 더 많이 기억하는 쪽을 채택한다.
   * 한쪽이 지워져도 다른 쪽이 살린다.
   */
  static async load(now: number): Promise<EventLog> {
    const [ls, idb] = [readLocal(), await readIdb()];
    const best = pickNewer(ls, idb);

    if (best) {
      const log = new EventLog(best);
      // 복구가 일어났으면 즉시 양쪽을 맞춰둔다
      if (!ls || !idb || ls.events.length !== idb.events.length) log.flush(now, true);
      return log;
    }

    const log = new EventLog({
      v: 1,
      seed: makeSeed(),
      createdAt: now,
      lastSeenAt: now,
      events: [],
    });
    log.append(now, 'game.created');
    log.flush(now, true);
    return log;
  }

  get isFirstEver(): boolean {
    return this.count('session.start') <= 1;
  }

  /**
   * 시계 역행 방어.
   * 시스템 시간을 되돌려도 햄스터를 되감지 않고, 부재 시간이 음수가 되지 않게 한다.
   * 벌을 주지는 않는다 — 그냥 조용히 0으로 취급한다.
   */
  elapsedSince(now: number): number {
    return Math.max(0, now - this.lastSeenAt);
  }

  append(t: number, type: EventType, data?: EventData): void {
    this.events.push(data ? { t, type, data } : { t, type });
    this.dirty = true;
  }

  all(): readonly GameEvent[] {
    return this.events;
  }

  between(t0: number, t1: number): GameEvent[] {
    return this.events.filter((e) => e.t >= t0 && e.t < t1);
  }

  ofType(type: EventType): GameEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  count(type: EventType): number {
    let n = 0;
    for (const e of this.events) if (e.type === type) n++;
    return n;
  }

  last(type: EventType): GameEvent | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i]!;
      if (e.type === type) return e;
    }
    return undefined;
  }

  /**
   * 친밀도: 함께한 세션 수에서 파생. 절대 화면에 숫자로 보이지 않는다.
   * 행동 확률(다가올까 / 무시할까)에만 쓰인다.
   */
  familiarity(): number {
    return 1 - Math.exp(-this.count('session.start') / 12);
  }

  flush(now: number, force = false): void {
    if (this.readOnly) return;
    if (!this.dirty && !force) return;
    if (!force && now - this.lastSaveAt < SAVE_INTERVAL_MS) return;

    this.lastSeenAt = Math.max(this.lastSeenAt, now);
    const data: Persisted = {
      v: 1,
      seed: this.seed,
      createdAt: this.createdAt,
      lastSeenAt: this.lastSeenAt,
      events: this.events,
      layout: this.layout,
    };
    if (writeLocal(data)) {
      this.dirty = false;
      this.lastSaveAt = now;
    }
    void writeIdb(data);
  }

  /** 백업 파일. 유일하게 기기 밖으로 나가는 경로다. */
  exportJson(): string {
    return JSON.stringify(
      {
        v: 1,
        seed: this.seed,
        createdAt: this.createdAt,
        lastSeenAt: this.lastSeenAt,
        events: this.events,
      },
      null,
      2,
    );
  }
}
