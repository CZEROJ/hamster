import { BREED_IDS, type BreedId } from '../content/breeds';
import { FOOD_IDS, type FoodId } from '../content/foods';
import {
  anchorOf,
  FURNITURE,
  FURNITURE_IDS,
  type Affordance,
  type FurnitureId,
} from '../content/furniture';
import { SHELL_IDS, type ShellId, type SubstrateId } from '../content/modules';
import type { EventLog } from '../core/log';
import { clamp } from '../core/math';
import {
  CAGE_W,
  groundY,
  MODULE_W,
  originX,
  ROOM_COLS,
  ROOM_ROWS,
  type Cell,
} from '../world';
import { seasonOf } from './season';

/**
 * 사육장 — 방 하나.
 *
 * ★ 한때 방을 늘리고 관으로 잇는 기능이 있었고, 그걸 걷어냈다.
 *
 *   방이 늘어나는 순간 전부가 변수가 된다. 벽이 어디서 사라지는지, 관이 어떻게
 *   꺾이는지, 배경이 어디까지 밝은지, 카메라가 얼마나 물러나는지, 햄스터가 어느
 *   바닥에 서 있는지. 만드는 사람도 노는 사람도 그 변수를 계속 머리에 이고 있어야 했다.
 *
 *   이 게임이 재미있어야 하는 지점은 방을 넓히는 게 아니라 그 안에서 사는 것이다.
 *   집을 고정하니 그 변수가 전부 상수가 됐고, 남은 건 햄스터와 가구와 시간뿐이다.
 *
 * 배치는 이벤트가 아니라 '현재 상태'다. 가구를 서른 번 옮긴 건 기억이 아니다.
 * 다만 '처음 놓은 순간'은 기억이라서 그때만 로그에 남긴다.
 */

/**
 * 처음부터 가지고 있는 먹이.
 *
 * 첫 세션이 제일 중요한 세션이라 빈손으로 시작하면 안 된다. 해바라기씨는
 * 햄스터 하면 떠오르는 것이고, 사과는 '뭘 더 줄 수 있나'를 알려준다.
 * 나머지는 소포로 늘어난다.
 */
const STARTER_FOODS: FoodId[] = ['sunflower'];

/**
 * 처음부터 있는 가구.
 *
 * ★ 불러올 때마다 이 목록을 합쳐 넣는다.
 *   새 기본 가구(급수기)를 추가했을 때, 이미 만들어진 세이브에는 그게 없어서
 *   '기본인데 못 쓰는 물건'이 된다. 시작 물건은 언제 시작했든 있어야 한다.
 */
const STARTER_FURNITURE: FurnitureId[] = ['house', 'bowl', 'water', 'shelf', 'ladder'];

/**
 * ★ 처음부터 있는 햄스터는 하나뿐이다.
 *
 * 골든은 소포에서 안 나온다. 얻는 게 아니라 처음부터 여기 살고 있던 애다.
 * 그리고 절대 집어넣을 수 없다 — 나머지 두 자리는 놀러 온 친구 자리고,
 * 이 방의 주인은 안 바뀐다.
 */
export const MY_BREED = 'golden' as const;
/** 동시에 사육장에 나와 있을 수 있는 수 */
export const MAX_ACTIVE = 3;

/** 방을 이루는 칸 하나. 렌더러와 바닥 그래프가 이걸 본다. */
export interface Module extends Cell {
  shell: ShellId;
  substrate: SubstrateId;
}

export interface PlacedFurniture extends Cell {
  id: FurnitureId;
  /** 칸 안에서의 로컬 x */
  x: number;
  /**
   * ★ 선반 위에 올려둔 높이 (바닥 기준). 없거나 0이면 톱밥 위다.
   *
   * '어느 선반 위'가 아니라 '얼마나 높이'로 저장한다. 선반은 옮기고 치울 수
   * 있는 물건이라, 특정 선반을 가리키면 그 선반이 사라졌을 때 무엇을 가리키는지
   * 알 수 없게 된다. 높이만 들고 있으면 판단은 "지금 그 높이에 판이 있나"
   * 하나로 끝나고, 없으면 떨어뜨리면 된다.
   */
  lift?: number;
}

/**
 * 선반 위에 올릴 수 있는 물건인가.
 *
 * 큰 것과 층을 만드는 것(선반·사다리·망루)은 제외한다. 선반 위에 선반을 올리면
 * 층이 층을 낳고, 그때부터 바닥 그래프가 감당할 수 없는 모양이 된다.
 */
export function canSitOnShelf(id: FurnitureId): boolean {
  const def = FURNITURE[id];
  return !def.platform && !def.climbHeight && def.w <= 40 && def.h <= 36;
}

/** 햄스터가 판 굴. 입구의 월드 x, 파낸 정도(0~1), 마지막으로 판 시각. */
export interface Burrow {
  x: number;
  depth: number;
  at: number;
}

/**
 * ★ 안 쓰는 굴은 시간당 이만큼 메워진다.
 *
 * 굴이 평생 하나뿐이면 햄스터가 영원히 같은 자리만 판다. 실제로는 파고,
 * 버리고, 다른 데를 판다. 그런데 '가끔 딴 데를 판다'를 확률로 넣으면
 * 그냥 무작위가 되고 이유가 안 보인다.
 *
 * 대신 안 쓰면 메워지게 한다. 그러면 자리가 바뀌는 데 이유가 생긴다 —
 * 자주 쓰던 굴은 깊어지고, 잊힌 굴은 톱밥에 묻힌다. 매일 오는 사람에겐
 * 굴이 그대로 남아 깊어지고, 한참 만에 온 사람에겐 새 자리에 새 굴이 있다.
 * 시간이 흐른 흔적이 배치에 남는 셈이다.
 *
 * 시간으로 계산하니까 매 틱 갱신할 필요가 없다. 읽을 때 그 자리에서 센다.
 */
const BURROW_FILL_PER_HOUR = 0.03;
/** 동시에 남아 있을 수 있는 굴 개수 */
const MAX_BURROWS = 4;

interface LayoutV3 {
  v: 3;
  shell: ShellId;
  substrate: SubstrateId;
  furniture: PlacedFurniture[];
  unlocked: FurnitureId[];
  /** 햄스터가 고른 창고 칸 */
  stashCell?: Cell | null;
  /** 창고에 쌓인 먹이 */
  stash?: Record<string, number>;
  /** 햄스터가 판 굴들 (예전 세이브엔 없다 — 없으면 아직 안 판 것) */
  burrows?: Burrow[];
  /** 가진 먹이 (예전 세이브엔 없다 — 그때는 전부 있었으니 전부로 친다) */
  foods?: FoodId[];
  /** 마지막으로 소포를 연 날 */
  lastGiftDay?: string;
  lastGiftAt?: number;
  /** 가진 햄스터 / 지금 나와 있는 햄스터 */
  hamsters?: BreedId[];
  active?: BreedId[];
}

/** 방을 늘릴 수 있던 시절의 저장 형식 */
interface LayoutOld {
  v?: number;
  pieces?: { shell?: ShellId; substrate?: SubstrateId }[];
  placed?: { id: FurnitureId; x: number }[];
  furniture?: PlacedFurniture[];
  unlocked?: FurnitureId[];
  stash?: Record<string, number>;
}

export class Habitat {
  /** 방을 이루는 칸들 — 크기가 고정이라 파생값이다 */
  modules: Module[] = [];
  furniture: PlacedFurniture[] = [];
  unlocked = new Set<FurnitureId>();
  bowlFood: FoodId | null = null;

  /** 방 하나의 껍데기와 바닥재 */
  shell: ShellId = 'glass';
  substrate: SubstrateId = 'wood';

  /**
   * ★ 창고 — 이 게임에서 유일하게 '그녀가 정하지 않은' 자리.
   * 햄스터가 스스로 고르고, 거기에 먹이를 옮겨 쌓는다.
   */
  stashCell: Cell | null = null;
  stash: Record<string, number> = {};

  /**
   * ★ 가진 먹이. 가구의 unlocked와 같은 문법이다.
   *
   * 개수를 세지 않는다. 사과를 한 번 얻으면 사과는 계속 줄 수 있다.
   * 개수가 생기면 먹이가 떨어질 수 있게 되는데, 이 프로젝트는 "굶는 일은
   * 없다"를 계약으로 걸어놨다. 그리고 재고 관리가 붙는 순간 아늑한 게임이
   * 아니라 살림이 된다.
   */
  foods = new Set<FoodId>(STARTER_FOODS);

  /** 마지막으로 소포를 연 날 ('YYYY-MM-DD'). 하루 한 번을 이 한 줄로 센다. */
  lastGiftDay = '';
  /** 마지막으로 연 시각 — 상자에 색이 차오르는 속도를 여기서 잰다 */
  lastGiftAt = 0;

  /**
   * ★ 가진 햄스터와, 지금 나와 있는 햄스터.
   *
   * 손님(visitors)과는 다른 것이다. 손님은 날짜로 정해져서 왔다가 가는
   * 날씨지만, 이 애들은 여기 산다. 넣어두면 '다른 방에서 자고 있는' 것이고
   * 꺼내면 사육장에서 같이 지낸다.
   *
   * 교대에 시간 제한도 비용도 없다. 쿨타임이 붙는 순간 아늑한 게임이 아니라
   * 출석 체크가 된다.
   */
  hamsters = new Set<BreedId>([MY_BREED]);
  active: BreedId[] = [MY_BREED];

  /**
   * ★ 굴 — 창고와 같은 종류의 것이다. 그녀가 정하지 않은 자리.
   *
   * 관을 걷어내면서 '사라졌다가 나온다'는 박자가 통째로 없어졌다. 굴이 그
   * 자리를 대신하는데, 관보다 낫다 — 관은 그녀가 설치한 길이지만 굴은
   * 햄스터가 판 길이다. 어디를 팔지 아무도 안 정해준다.
   *
   * 한 번 파면 남는다. 그래서 저장한다. 다음에 켰을 때 굴이 그대로 있는 것,
   * 그게 '내가 없는 동안에도 여기 살고 있었다'의 증거가 된다.
   *
   * 여러 개일 수 있다. 하나뿐이면 영원히 같은 자리만 파게 된다.
   */
  burrows: Burrow[] = [];

  private signals = new Map<string, number>();

  constructor(private readonly log: EventLog) {
    const raw = log.layout as unknown as LayoutV3 | LayoutOld | undefined;

    const old = raw as LayoutOld | undefined;
    /**
     * 빈 객체 `{}`도 truthy다. 그것만 보고 '옛 세이브'로 판단하면
     * 새로 시작한 사람이 가구 없는 빈 방을 받는다 — 실제로 그렇게 났다.
     * 옮길 내용이 진짜로 들어 있을 때만 이사 분기로 간다.
     */
    const hasOld = !!(
      old?.pieces?.length ||
      old?.placed?.length ||
      old?.furniture?.length ||
      old?.unlocked?.length
    );

    if (raw && (raw as LayoutV3).v === 3) {
      const l = raw as LayoutV3;
      this.shell = l.shell;
      this.substrate = l.substrate;
      this.furniture = (l.furniture ?? []).filter((f) => FURNITURE[f.id]);
      this.unlocked = new Set([...(l.unlocked ?? []), ...STARTER_FURNITURE]);
      this.stashCell = l.stashCell ?? null;
      this.stash = l.stash ?? {};
      this.burrows = l.burrows ?? [];
      // 먹이 목록이 없던 시절 세이브 = 전부 갖고 있던 시절이다
      this.foods = new Set(l.foods ?? FOOD_IDS);
      this.lastGiftDay = l.lastGiftDay ?? '';
      this.lastGiftAt = l.lastGiftAt ?? 0;
      this.hamsters = new Set(l.hamsters ?? [MY_BREED]);
      this.active = (l.active ?? [MY_BREED]).filter((b) => this.hamsters.has(b));
      if (!this.active.includes(MY_BREED)) this.active.unshift(MY_BREED);
    } else if (hasOld) {
      /**
       * ── 방이 여러 개였던 세이브를 방 하나로 옮긴다 ──────────
       * 기억(이벤트 로그)은 한 줄도 안 건드린다. 옮기는 건 배치뿐이다.
       * 가구는 이름만 살리고 자리는 새 방 안에 다시 편다 — 예전 좌표를 그대로 쓰면
       * 없어진 방 자리에 가구가 떠 있게 된다.
       */
      const l = raw as LayoutOld;
      const first = l.pieces?.[0];
      this.shell = first?.shell ?? 'glass';
      this.substrate = first?.substrate ?? 'wood';
      const ids = (l.furniture ?? l.placed ?? []).map((f) => f.id).filter((id) => FURNITURE[id]);
      this.unlocked = new Set([...(l.unlocked ?? []), ...STARTER_FURNITURE]);
      this.stash = l.stash ?? {};
      this.expand();
      this.furniture = [];
      let x = 12;
      for (const id of [...new Set(ids)]) {
        const w = FURNITURE[id].w;
        if (x + w > ROOM_COLS * MODULE_W - 12) break;
        this.furniture.push({ id, cx: Math.floor(x / MODULE_W), cy: ROOM_ROWS - 1, x: x % MODULE_W });
        x += w + 10;
      }
      this.save();
    } else {
      // ── 첫 실행 ──────────────────────────────────────
      this.shell = 'glass';
      this.substrate = 'wood';
      this.unlocked = new Set<FurnitureId>(STARTER_FURNITURE);
      this.furniture = [
        { id: 'house', cx: 3, cy: ROOM_ROWS - 1, x: 20 },
        { id: 'bowl', cx: 0, cy: ROOM_ROWS - 1, x: 20 },
        { id: 'water', cx: 6, cy: ROOM_ROWS - 1, x: 26 },
      ];
      this.save();
    }
    this.expand();
    this.settleFurniture();
    this.devUnlockAll();
  }

  /**
   * ★ 개발용 — `?unlock` 이 붙으면 전부 열어준다.
   *
   * 러닝휠은 '이유 없이 뛰는 걸 두 번 보면' 열리는데, 그림을 고치려고 그걸
   * 매번 기다릴 수는 없다. 그렇다고 시작 목록에 넣으면 게임 설계가 바뀐다.
   *
   * `import.meta.env.DEV` 안에 있어서 배포본에는 통째로 사라진다 —
   * 예전에 ?reset을 같은 방식으로 넣고 빌드 해시가 안 변하는 걸 확인했다.
   */
  private devUnlockAll(): void {
    if (!import.meta.env.DEV) return;
    if (typeof location === 'undefined') return;
    if (!new URLSearchParams(location.search).has('unlock')) return;
    for (const id of FURNITURE_IDS) this.unlocked.add(id);
    for (const id of FOOD_IDS) this.foods.add(id);
    for (const id of BREED_IDS) this.hamsters.add(id);
  }

  /** 고정 크기 방을 칸으로 편다 */
  expand(): void {
    this.modules = [];
    for (let cy = 0; cy < ROOM_ROWS; cy++) {
      for (let cx = 0; cx < ROOM_COLS; cx++) {
        this.modules.push({ cx, cy, shell: this.shell, substrate: this.substrate });
      }
    }
  }

  /** 가구가 방 밖으로 나가 있으면 안으로 들여놓는다 */
  private settleFurniture(): void {
    let moved = false;
    for (const f of this.furniture) {
      const cy = ROOM_ROWS - 1;
      if (f.cy !== cy) {
        f.cy = cy;
        moved = true;
      }
      const fixed = this.clampInRow(f, f.x, FURNITURE[f.id].w);
      if (Math.abs(fixed - f.x) > 0.5) {
        f.x = fixed;
        moved = true;
      }
    }
    if (moved) this.save();
  }

  /** 개발용 데모 주입에서 배치를 갈아끼운 뒤 호출한다 */
  saveNow(): void {
    this.expand();
    this.save();
  }

  private save(): void {
    const l: LayoutV3 = {
      v: 3,
      shell: this.shell,
      substrate: this.substrate,
      furniture: this.furniture,
      unlocked: [...this.unlocked],
      stashCell: this.stashCell,
      stash: this.stash,
      burrows: this.burrows,
      foods: [...this.foods],
      lastGiftDay: this.lastGiftDay,
      lastGiftAt: this.lastGiftAt,
      hamsters: [...this.hamsters],
      active: this.active,
    };
    this.log.layout = l as unknown as Record<string, unknown>;
    this.log.touch();
  }

  // ── 방 ────────────────────────────────────────────────

  cells(): Cell[] {
    return this.modules.map((m) => ({ cx: m.cx, cy: m.cy }));
  }

  moduleAt(c: Cell): Module | undefined {
    return this.modules.find((m) => m.cx === c.cx && m.cy === c.cy);
  }

  has(c: Cell): boolean {
    return c.cx >= 0 && c.cx < ROOM_COLS && c.cy >= 0 && c.cy < ROOM_ROWS;
  }

  /** 설 수 있는 칸 = 맨 아랫줄 */
  standable(c: Cell): boolean {
    return this.has(c) && c.cy === ROOM_ROWS - 1;
  }

  setSubstrate(_c: Cell, s: SubstrateId): void {
    this.substrate = s;
    this.expand();
    this.save();
  }

  // ── 창고 ──────────────────────────────────────────────

  /** 창고는 방 구석이다. 밥그릇에서 제일 먼 쪽. */
  ensureStashCell(): Cell | null {
    if (this.stashCell && this.has(this.stashCell)) return this.stashCell;
    const bowl = this.furniture.find((f) => f.id === 'bowl');
    const bowlX = bowl ? originX(bowl.cx) + bowl.x : 0;
    const far = bowlX < (ROOM_COLS * MODULE_W) / 2 ? ROOM_COLS - 1 : 0;
    this.stashCell = { cx: far, cy: ROOM_ROWS - 1 };
    this.save();
    return this.stashCell;
  }

  addToStash(food: string): void {
    this.stash[food] = (this.stash[food] ?? 0) + 1;
    this.save();
  }

  stashTotal(): number {
    return Object.values(this.stash).reduce((a, b) => a + b, 0);
  }

  // ── 가구 ──────────────────────────────────────────────

  inCell(c: Cell): PlacedFurniture[] {
    return this.furniture.filter((f) => f.cx === c.cx && f.cy === c.cy);
  }

  /**
   * 가구는 방 안에 갇혀야 한다.
   * 여유 8 — 나무집 지붕처럼 선언한 폭보다 몇 픽셀 더 튀어나오게 그려지는 게 있다.
   */
  private clampInRow(c: Cell, x: number, w: number): number {
    const min = 8;
    const max = ROOM_COLS * MODULE_W - w - 8;
    return clamp(originX(c.cx) + x, min, Math.max(min, max)) - originX(c.cx);
  }

  place(id: FurnitureId, c: Cell, x: number, now: number, lift = 0): void {
    const def = FURNITURE[id];
    this.furniture.push({
      id,
      cx: c.cx,
      cy: ROOM_ROWS - 1,
      x: this.clampInRow(c, x, def.w),
      lift: lift || undefined,
    });
    if (!this.log.all().some((e) => e.type === 'furniture.firstPlaced' && e.data?.id === id)) {
      this.log.append(now, 'furniture.firstPlaced', { id });
    }
    this.save();
  }

  /**
   * ★ 올려둔 물건 밑에 판이 남아 있는지 확인한다.
   *
   * 선반을 치우거나 옮기면 그 위 물건이 공중에 뜬다. 예전에 햄스터로 똑같은
   * 걸 겪었고 며칠 걸렸다 — 그때 배운 게 "떠 있을 수 있는 상태를 만들지 말고,
   * 매번 발밑을 확인해서 없으면 내려놓는다"였다. 여기도 같은 규칙이다.
   *
   * 판이 없어지면 조용히 톱밥으로 내려온다. 사라지지 않는다.
   */
  settleLifted(): void {
    let moved = false;
    for (const f of this.furniture) {
      if (!f.lift) continue;
      const cx = originX(f.cx) + f.x + FURNITURE[f.id].w / 2;
      const wantY = groundY(f.cy) - f.lift;
      const onPlank = this.furniture.some((o) => {
        if (o === f) return false;
        const def = FURNITURE[o.id];
        if (!def.platform) return false;
        const oy = groundY(o.cy) - def.platform.height - (o.lift ?? 0);
        if (Math.abs(oy - wantY) > 1.5) return false;
        const ox = originX(o.cx) + o.x;
        return cx >= ox + def.platform.x0 - 2 && cx <= ox + def.platform.x1 + 2;
      });
      if (!onPlank) {
        f.lift = undefined;
        moved = true;
      }
    }
    if (moved) this.save();
  }

  /**
   * 벽에 거는 물건을 가까운 쪽 벽으로 붙인다.
   *
   * 자유롭게 못 놓는 대신 어디에 놔도 제대로 놓인다. 급수기가 톱밥 한가운데
   * 서 있는 것보다, 왼쪽 아니면 오른쪽 벽 둘 중 하나인 편이 훨씬 낫다.
   */
  snapToWall(id: FurnitureId, wx: number): { cell: Cell; x: number } {
    const w = FURNITURE[id].w;
    const left = wx + w / 2 < CAGE_W / 2;
    const cx = left ? 0 : ROOM_COLS - 1;
    const x = left ? 3 : MODULE_W - w - 3;
    return { cell: { cx, cy: ROOM_ROWS - 1 }, x };
  }

  /** 이 지점에 올려놓을 만한 선반 높이 (없으면 0 = 톱밥) */
  liftAt(wx: number, wy: number, w: number): number {
    let best = 0;
    let bestD = 16;
    for (const o of this.furniture) {
      const def = FURNITURE[o.id];
      if (!def.platform) continue;
      const ox = originX(o.cx) + o.x;
      if (wx < ox + def.platform.x0 || wx > ox + def.platform.x1) continue;
      if (w > def.platform.x1 - def.platform.x0) continue; // 판보다 넓으면 못 올린다
      const top = groundY(o.cy) - def.platform.height - (o.lift ?? 0);
      const d = Math.abs(wy - top);
      if (d < bestD) {
        bestD = d;
        best = groundY(o.cy) - top;
      }
    }
    return best;
  }

  move(index: number, c: Cell, x: number, lift?: number): void {
    const f = this.furniture[index];
    if (!f) return;
    f.cx = c.cx;
    f.cy = ROOM_ROWS - 1;
    f.x = this.clampInRow(c, x, FURNITURE[f.id].w);
    if (lift !== undefined) f.lift = lift || undefined;
    this.save();
    this.settleLifted();
  }

  remove(index: number): void {
    this.furniture.splice(index, 1);
    this.save();
    // 이 물건이 선반이었다면 그 위에 있던 것들이 내려와야 한다
    this.settleLifted();
  }

  isPlaced(id: FurnitureId): boolean {
    return this.furniture.some((f) => f.id === id);
  }

  /**
   * ★ 여러 개 놓을 수 있는 물건 — 선반뿐이다.
   *
   * 한동안 전부 여러 개 놓을 수 있었다. 그랬더니 사육장이 같은 집 네 채,
   * 같은 밥그릇 세 개가 됐다. 방을 꾸미는 게 아니라 도장을 찍는 게 된다.
   * 하루에 하나씩 받는 게임에서 하나를 복사할 수 있으면 모을 이유도 옅어진다.
   *
   * 선반만 예외인 건 선반이 '하나의 물건'이 아니라 **길이**이기 때문이다.
   * 옆에 붙이면 하나의 긴 선반이 된다(planksJoin). 두 개를 못 놓으면
   * 긴 선반이라는 것 자체가 없어진다.
   */
  private static readonly STACKABLE = new Set<FurnitureId>(['shelf']);

  /**
   * 지금 이걸 (하나 더) 놓을 수 있는가.
   *
   * ★ 쟁반 그림과 입력 판정이 **같은 함수**를 봐야 한다.
   *   따로 두면 흐릿하게 그려놓고 눌리거나, 멀쩡해 보이는데 안 눌린다.
   *   이 프로젝트에서 같은 판단을 두 군데 둔 건 전부 버그가 됐다.
   */
  canPlace(id: FurnitureId): boolean {
    if (!this.unlocked.has(id)) return false;
    if (Habitat.STACKABLE.has(id)) return true;
    return !this.isPlaced(id);
  }

  /** 종류별로 몇 개 나가 있는지 (쟁반에 개수를 적는다) */
  placedIds(): Map<FurnitureId, number> {
    const m = new Map<FurnitureId, number>();
    for (const f of this.furniture) m.set(f.id, (m.get(f.id) ?? 0) + 1);
    return m;
  }

  /** 소포에서 나온 것을 받는다 */
  receive(item: { kind: 'furniture' | 'food' | 'hamster'; id: string }, day: string, at = 0): void {
    this.lastGiftAt = at;
    if (item.kind === 'furniture') this.unlocked.add(item.id as FurnitureId);
    else if (item.kind === 'hamster') {
      this.hamsters.add(item.id as BreedId);
      // 새 친구는 자리가 있으면 바로 나온다 — 받자마자 만나는 게 맞다
      if (this.active.length < MAX_ACTIVE) this.active.push(item.id as BreedId);
    } else this.foods.add(item.id as FoodId);
    this.lastGiftDay = day;
    this.save();
  }

  /**
   * ★ 한 번 얻은 물건은 몇 개든 놓을 수 있다.
   *
   * 예전엔 이미 놓은 건 목록에서 빠졌다. 선반이 하나뿐이면 층이 하나뿐이고,
   * 그러면 '꾸미기'가 아니라 '배치 퍼즐'이 된다. 개수를 세지 않기로 한
   * 이상(먹이도 그렇다) 여기서만 한 개로 묶을 이유가 없다.
   */
  shelf(): FurnitureId[] {
    return [...this.unlocked];
  }

  /** 그 칸에서 이 기능을 제공하는 가구들 */
  affordIn(c: Cell, a: Affordance): PlacedFurniture[] {
    return this.inCell(c).filter((f) => FURNITURE[f.id].affords.includes(a));
  }

  /** 방 전체에서 이 기능을 제공하는 가구들 */
  affordAll(a: Affordance): PlacedFurniture[] {
    return this.furniture.filter((f) => FURNITURE[f.id].affords.includes(a));
  }

  /** 가구 안에서 햄스터가 자리잡는 '월드' x */
  spotX(f: PlacedFurniture): number {
    return originX(f.cx) + f.x + anchorOf(FURNITURE[f.id]);
  }

  /** 가구 왼쪽 끝의 월드 x */
  furnitureX(f: PlacedFurniture): number {
    return originX(f.cx) + f.x;
  }

  // ── 굴 ────────────────────────────────────────────────

  /** 메워진 정도를 반영한 지금 깊이 */
  burrowDepth(b: Burrow, now: number): number {
    const hours = Math.max(0, now - b.at) / 3600_000;
    return clamp(b.depth - hours * BURROW_FILL_PER_HOUR, 0, 1);
  }

  /** 아직 남아 있는 굴들 (다 메워진 건 버린다) */
  liveBurrows(now: number): Burrow[] {
    return this.burrows.filter((b) => this.burrowDepth(b, now) > 0.03);
  }

  /** 이 x 근처의 굴 */
  burrowNear(x: number, now: number, r = 14): Burrow | null {
    let best: Burrow | null = null;
    let bestD = r;
    for (const b of this.liveBurrows(now)) {
      const d = Math.abs(b.x - x);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  /** 제일 깊은 굴 — 잠자리 후보 */
  deepestBurrow(now: number): Burrow | null {
    let best: Burrow | null = null;
    for (const b of this.liveBurrows(now)) {
      if (!best || this.burrowDepth(b, now) > this.burrowDepth(best, now)) best = b;
    }
    return best;
  }

  /**
   * 굴을 판다.
   *
   * 한 번에 다 안 파진다 — 9초쯤 파야 끝까지 들어간다. 굴 파기 한 번이
   * 5~9초고 자리까지 걸어가는 시간도 있어서 여러 번에 나눠 깊어진다.
   * 하루 만에 완성되지 않는 게 중요하다. 그래야 며칠 만에 들어왔을 때
   * 굴이 깊어져 있는 걸 알아챌 수 있다.
   */
  digBurrow(b: Burrow, dt: number, now: number): number {
    const before = this.burrowDepth(b, now);
    b.depth = clamp(before + dt * 0.11, 0, 1);
    b.at = now;
    // 매 틱 저장하면 로그가 지저분해진다. 눈에 띄게 깊어졌을 때만 적는다.
    if (Math.floor(b.depth * 20) !== Math.floor(before * 20)) this.save();
    return b.depth;
  }

  /**
   * 이번에 팔 굴을 고른다.
   *
   * 아직 덜 판 굴이 있으면 거기로 간다 — 파다 만 구멍을 놔두고 새로
   * 파기 시작하면 아무것도 완성되지 않는다. 다 판 굴만 있으면 새로 판다.
   *
   * 자리는 가구 밑을 피하고(집이나 쳇바퀴 아래가 뚫리면 물건이 뜬다),
   * 이미 판 굴에서도 떨어뜨린다. 실제 햄스터가 구석을 좋아하니 벽 쪽에
   * 가산점을 준다. 여덟 군데를 뽑아 제일 나은 데를 고른다 — 정확할 필요는
   * 없고 '아무 데나'만 아니면 된다.
   */
  pickBurrow(
    x0: number,
    x1: number,
    now: number,
    pick: (a: number, b: number) => number,
  ): Burrow {
    const live = this.liveBurrows(now);
    const unfinished = live.find((b) => this.burrowDepth(b, now) < 0.92);
    if (unfinished) return unfinished;

    const avoid = [...this.furniture.map((f) => this.spotX(f)), ...live.map((b) => b.x)];
    const lo = x0 + 18;
    const hi = x1 - 18;
    let best = pick(lo, hi);
    let bestScore = -Infinity;
    for (let i = 0; i < 8; i++) {
      const c = pick(lo, hi);
      const clear = avoid.length === 0 ? 40 : Math.min(...avoid.map((a) => Math.abs(a - c)));
      const corner = Math.max(0, 1 - Math.min(c - x0, x1 - c) / 70) * 22;
      const s = Math.min(clear, 60) + corner;
      if (s > bestScore) {
        bestScore = s;
        best = c;
      }
    }

    // 다 메워진 굴은 버리고, 너무 많아지면 제일 얕은 것부터 지운다
    this.burrows = live.sort((a, b) => this.burrowDepth(b, now) - this.burrowDepth(a, now));
    while (this.burrows.length >= MAX_BURROWS) this.burrows.pop();

    /**
     * ★ 첫 삽은 이미 뜬 것으로 친다.
     *
     * depth 0으로 만들었더니 liveBurrows(0.03 이하는 버린다)가 방금 만든 굴을
     * 곧바로 없는 것으로 취급했다. 그래서 파러 갔다가 목표를 못 찾고 돌아서기를
     * 170초 내내 반복했다 — 굴은 하나 생겼는데 깊이가 영원히 0이었다.
     *
     * '자리를 정했다'는 건 이미 한 번 긁었다는 뜻이기도 하니, 처음부터
     * 조금 파인 상태로 시작하는 게 맞다.
     */
    const made: Burrow = { x: best, depth: 0.08, at: now };
    this.burrows.push(made);
    this.save();
    return made;
  }

  // ── 해금 ──────────────────────────────────────────────

  /**
   * 햄스터가 신호를 보냈다. 한 세션 안에서 같은 행동을 반복하면 그게 '원한다'는 뜻이다.
   * 숫자가 임계값을 넘는 게 아니라 '관찰'이 해금 조건이라는 게 핵심이다.
   */
  noteBehavior(behavior: string, now: number): FurnitureId | null {
    const n = (this.signals.get(behavior) ?? 0) + 1;
    this.signals.set(behavior, n);

    for (const id of FURNITURE_IDS) {
      const u = FURNITURE[id].unlock;
      if (u.kind !== 'signal' || u.behavior !== behavior || n < u.count) continue;
      if (this.unlocked.has(id)) continue;
      this.unlocked.add(id);
      this.save();
      this.log.append(now, 'hamster.wants', { id });
      this.log.append(now, 'furniture.unlocked', { id, by: 'signal' });
      return id;
    }
    return null;
  }

  checkTimedUnlocks(now: number, dayNumber: number): FurnitureId[] {
    const opened: FurnitureId[] = [];
    const season = seasonOf(now);
    for (const id of FURNITURE_IDS) {
      if (this.unlocked.has(id)) continue;
      const u = FURNITURE[id].unlock;
      const ok =
        (u.kind === 'day' && dayNumber >= u.day) || (u.kind === 'season' && u.season === season);
      if (!ok) continue;
      this.unlocked.add(id);
      this.log.append(now, 'furniture.unlocked', { id, by: u.kind });
      opened.push(id);
    }
    if (opened.length > 0) this.save();
    return opened;
  }

  resetSignals(): void {
    this.signals.clear();
  }
}

/** 첫 실행 때 방 색을 하나 고른다 — 넷 다 서로 어울려서 뭐가 나와도 괜찮다 */
export const pickShell = (r: { pick: <T>(a: readonly T[]) => T }): ShellId => r.pick(SHELL_IDS);
