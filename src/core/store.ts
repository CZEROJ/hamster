/**
 * 영속화 계층.
 *
 * 이 게임에서 세이브 유실은 버그가 아니라 사고다. 6개월치 일기가 날아가는 건
 * 기능 하나가 망가지는 것과 차원이 다르다. 그래서 같은 데이터를 두 군데에 쓴다.
 *
 *   localStorage — 빠르고 동기적. 부팅 시 즉시 읽는다.
 *   IndexedDB    — 용량 크고, 브라우저 정리에서 살아남는 경우가 많다.
 *
 * 부팅할 때 둘 다 읽어서 더 '긴' 쪽(이벤트가 많은 쪽)을 채택한다.
 * 한쪽이 지워져도 다른 쪽이 복구한다.
 *
 * ⚠️ 이걸로도 기기 분실·브라우저 삭제는 못 막는다. 그건 서버가 있어야 한다.
 *    일기가 두 달치 쌓이기 전에 결정해야 할 문제다.
 */
/**
 * ?demo 를 붙이면 완전히 분리된 저장소를 쓴다.
 * 실제 세이브는 절대 건드리지 않는다 — 데모 보려다 기억이 날아가면 최악이다.
 */
export const DEMO_MODE =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');

const SUFFIX = DEMO_MODE ? '.demo' : '';
const LS_KEY = `hamster.save.v1${SUFFIX}`;
const DB_NAME = `hamster${SUFFIX}`;
const DB_STORE = 'save';
const DB_KEY = 'main';
const LOCK_KEY = `hamster.lock.v1${SUFFIX}`;

export interface Persisted {
  v: 1;
  seed: number;
  createdAt: number;
  lastSeenAt: number;
  events: unknown[];
  /**
   * 방의 배치와 해금 목록.
   *
   * 이건 일부러 이벤트 로그에 넣지 않았다. 로그는 '기억'이고 배치는 '현재 상태'다.
   * 가구를 30번 옮긴 기록이 일기의 원천에 섞이면 안 된다.
   * (다만 같은 파일에 실어서 이중 저장·백업은 그대로 받는다)
   */
  layout?: Record<string, unknown>;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * 데모 저장소를 비운다.
 * ?demo는 '지금 코드가 어떤 상태인지' 보는 창이라 항상 새로 시작해야 한다.
 * 예전 세이브가 남아 있으면 옛날 화면을 보고 착각하게 된다.
 */
/**
 * ?reset — 진짜 세이브를 통째로 지우고 처음부터 시작한다.
 *
 * 개발 중에만 쓴다. 배포본에 남기면 링크 하나로 남의 기억이 날아갈 수 있고,
 * 이 게임에서 그건 세이브 손상이 아니라 관계가 사라지는 일이다.
 * 그래서 개발 서버에서만 살아 있고 빌드에서는 통째로 빠진다.
 */
export function resetIfAsked(): void {
  if (!import.meta.env.DEV) return;
  if (!new URLSearchParams(location.search).has('reset')) return;
  try {
    localStorage.removeItem('hamster.save.v1');
    localStorage.removeItem('hamster.lock.v1');
    localStorage.removeItem('hamster.crateSeen.v1');
    indexedDB.deleteDatabase('hamster');
  } catch {
    /* 지우기 실패해도 게임은 돌아가야 한다 */
  }
  // 주소에서 ?reset을 떼고 다시 연다 — 안 그러면 새로고침마다 계속 지운다
  location.replace(location.pathname);
}

export function clearDemoStorage(): void {
  if (!DEMO_MODE) return;
  try {
    localStorage.removeItem(LS_KEY);
    localStorage.removeItem(LOCK_KEY);
    indexedDB.deleteDatabase(DB_NAME);
  } catch {
    /* 지우기 실패해도 게임은 돌아가야 한다 */
  }
}

export function readLocal(): Persisted | null {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (!s) return null;
    const p = JSON.parse(s) as Persisted;
    return p && p.v === 1 && Array.isArray(p.events) ? p : null;
  } catch {
    return null;
  }
}

export async function readIdb(): Promise<Persisted | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(DB_KEY);
      req.onsuccess = () => {
        const p = req.result as Persisted | undefined;
        resolve(p && p.v === 1 && Array.isArray(p.events) ? p : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function writeLocal(data: Persisted): boolean {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export async function writeIdb(data: Persisted): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(data, DB_KEY);
  } catch {
    /* 저장 실패로 게임이 멈추는 일은 없어야 한다 */
  }
}

/** 둘 중 더 많이 기억하고 있는 쪽을 고른다. */
export function pickNewer(a: Persisted | null, b: Persisted | null): Persisted | null {
  if (!a) return b;
  if (!b) return a;
  if (a.events.length !== b.events.length) return a.events.length > b.events.length ? a : b;
  return (a.lastSeenAt ?? 0) >= (b.lastSeenAt ?? 0) ? a : b;
}

// ────────────────────────────────────────────────────────────
// 탭 잠금 — 두 탭이 같은 세이브에 쓰면 기억이 갈라진다.
// 먼저 잡은 탭만 쓰고, 나머지는 조용히 읽기 전용이 된다.
// (경고창을 띄우지 않는다. 이 게임에 에러 대화상자가 뜨는 일은 없어야 한다.)
// ────────────────────────────────────────────────────────────
const LOCK_TTL = 6000;

export class TabLock {
  private readonly id = Math.random().toString(36).slice(2);
  private lastBeat = 0;
  primary = false;

  constructor(now: number) {
    this.tryClaim(now);
  }

  update(now: number): void {
    if (now - this.lastBeat < 2000) return;
    this.lastBeat = now;
    if (this.primary) this.beat(now);
    else this.tryClaim(now); // 저쪽 탭이 닫혔으면 이어받는다
  }

  private tryClaim(now: number): void {
    try {
      const raw = localStorage.getItem(LOCK_KEY);
      if (raw) {
        const cur = JSON.parse(raw) as { id: string; t: number };
        if (cur.id !== this.id && now - cur.t < LOCK_TTL) {
          this.primary = false;
          return;
        }
      }
      this.beat(now);
      this.primary = true;
    } catch {
      this.primary = true;
    }
  }

  private beat(now: number): void {
    try {
      localStorage.setItem(LOCK_KEY, JSON.stringify({ id: this.id, t: now }));
    } catch {
      /* noop */
    }
  }

  release(): void {
    if (!this.primary) return;
    try {
      localStorage.removeItem(LOCK_KEY);
    } catch {
      /* noop */
    }
  }
}
