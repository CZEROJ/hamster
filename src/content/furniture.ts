import type { Season } from '../sim/season';
import { CAGE_W } from '../world';

/**
 * 가구.
 *
 * ★ 해금 규칙에 재료도 화폐도 제작대도 없다.
 *   도토리를 줍는 행위에는 감정이 없다. 대신 두 가지로만 열린다:
 *
 *   1) 햄스터가 보내는 신호 — 자꾸 구석을 판다 → 터널. 이유 없이 뛴다 → 러닝휠.
 *      해금 자체가 캐릭터 순간이 된다. 숫자가 임계값을 넘는 게 아니라.
 *   2) 시간 — 어떤 건 그냥 며칠 지나야, 어떤 건 그 계절이 와야 존재한다.
 *      공짜로 기대가 생기고, 돌아올 이유가 된다.
 */

/**
 * ★ 스무 가지인 이유, 그리고 스무 가지가 위험한 이유.
 *
 * 가짓수가 늘면 '꾸미기'가 넓어지지만, 아무거나 채우면 상자가 집이 아니라
 * 카탈로그가 된다. 그래서 새로 넣는 것마다 둘 중 하나는 있어야 한다:
 *
 *   · 햄스터가 **다르게 행동하게** 만든다 (모래목욕통, 원반, 계단)
 *   · 방의 **모양을 바꾼다** (다리, 망루, 러그)
 *
 * 둘 다 아니면 안 넣었다. 예쁘기만 한 물건은 두 번째 날부터 안 보인다.
 */
export type FurnitureId =
  | 'shelf'
  | 'ladder'
  | 'hammock'
  | 'house'
  | 'bowl'
  | 'wheel'
  | 'tunnel'
  | 'cloudbed'
  | 'pot'
  | 'toybox'
  | 'bridge'
  | 'stairs'
  | 'tower'
  | 'sandbath'
  | 'saucer'
  | 'chewBlock'
  | 'hayBale'
  | 'logTunnel'
  | 'teacup'
  | 'rug'
  | 'water';

/** 이 가구가 햄스터에게 '열어주는' 행동 */
export type Affordance = 'sleep' | 'eat' | 'drink' | 'run' | 'hide' | 'climb' | 'nibble';

export type Unlock =
  | { kind: 'start' }
  | { kind: 'day'; day: number }
  | { kind: 'season'; season: Season }
  /** 햄스터가 한 세션 안에서 같은 행동을 count번 하면 신호가 된다 */
  | { kind: 'signal'; behavior: string; count: number };

export interface FurnitureDef {
  id: FurnitureId;
  name: string;
  w: number;
  h: number;
  affords: Affordance[];
  unlock: Unlock;
  /** 잠자리/먹이 지점의 중심 오프셋 (가구 왼쪽 기준) */
  anchor?: number;
  /**
   * 이 가구가 만드는 '걸어 다닐 수 있는 면'.
   * 선반처럼 위에 올라설 수 있는 것만 갖는다. 케이지에 층을 만드는 것이 이것이다.
   */
  platform?: { height: number; x0: number; x1: number };
  /** 오르내릴 수 있는 높이 (사다리). 층과 층을 잇는다. */
  climbHeight?: number;
  /**
   * 통과할 수 있는 관. 양쪽 입구의 로컬 x.
   *
   * 이게 있으면 햄스터가 '숨기'를 고를 때 웅크리는 대신 **통과한다** —
   * 한쪽으로 들어가 반대쪽으로 나온다. 굴이 세로라면 이건 가로다.
   */
  tube?: { x0: number; x1: number };
  /**
   * 벽에 거는 물건. 놓을 때 가까운 쪽 벽(왼/오른쪽)에 붙는다.
   *
   * 급수기가 톱밥 한가운데 서 있으면 사육장을 아는 사람 눈에 바로 어색하다.
   * 자유롭게 못 놓는 대신 **어디 놔도 제대로 놓인다** — 그게 더 낫다.
   */
  mount?: 'wall';
  /**
   * @param spin 지금 이 물건이 '쓰이고 있는 정도'로 누적된 각도.
   *   러닝휠처럼 햄스터가 타야 움직이는 물건만 본다.
   */
  /**
   * @param joins 같은 높이의 판이 좌/우에 붙어 있는가.
   *   붙어 있으면 그쪽 다리를 안 그린다 — 두 개가 아니라 긴 하나로 보여야 한다.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    ground: number,
    t: number,
    spin?: number,
    joins?: { l: boolean; r: boolean },
  ): void;
  /**
   * 햄스터보다 **뒤에** 그려지는 부분 (있으면).
   * 러닝휠의 가까운 쪽 테처럼, 몸을 가로질러야 '안에 있다'가 되는 것들.
   */
  drawFront?(
    ctx: CanvasRenderingContext2D,
    x: number,
    ground: number,
    t: number,
    spin?: number,
  ): void;
}

const rect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string) => {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
};

/**
 * 터널 몸통. 두 번 그린다 — 평소엔 햄스터 앞에, 안에 있을 땐 뒤에도.
 * 그래서 한 함수로 빼놨다. 따로 그리면 둘이 어긋난다.
 */
/**
 * ★ 터널은 반투명 플라스틱이다.
 *
 * 처음엔 불투명한 골판지로 그렸다. 그랬더니 안에 들어간 순간 그냥 사라져서
 * **'통과'가 아니라 '가려짐'**이 됐다. 옆에서 본 관이라 입구가 세로로 얇은
 * 타원이고, 그 구멍으로 보여주는 것도 살점 한 조각밖에 안 된다.
 *
 * 실제 햄스터 터널이 반투명 플라스틱인 게 여기서 답이 된다. 안이 비치면
 * 들어가는 것도, 지나가는 것도, 나오는 것도 전부 보인다. 그리고 비쳐 보이는
 * 것과 그냥 앞에 있는 것은 **색이 다르다** — 그 차이가 '안에 있다'를 만든다.
 *
 * @param front 햄스터보다 뒤에 그리는 판인가. 이때만 반투명으로 덮는다.
 */
function tunnelBody(c: CanvasRenderingContext2D, x: number, g: number, front = false): void {
  const w = 64;
  const H = 32; // 관 높이 — 귀까지 들어가야 한다
  const MR = 5.5; // 입구 타원 가로 반지름
  const cy = g - H / 2; // 관 중심선

  /**
   * ★ 옆에서 본 원통.
   *
   * 처음엔 아치를 그려놓고 골판 선과 입구 타원을 따로 얹었는데, 셋의 좌표가
   * 서로 안 맞아서 선이 지붕 위로 삐져나오고 입구가 관보다 커서 떠 보였다.
   * **몸통 윤곽을 한 번 만들어 clip으로 가둔다** — 안에 뭘 그려도 절대
   * 밖으로 안 나간다. 계산을 세 번 하지 않는 게 요점이다.
   */
  const outline = (): void => {
    c.beginPath();
    c.moveTo(x + MR, g);
    c.lineTo(x + w - MR, g);
    c.ellipse(x + w - MR, cy, MR, H / 2, 0, Math.PI * 0.5, Math.PI * 1.5, true);
    c.lineTo(x + MR, g - H);
    c.ellipse(x + MR, cy, MR, H / 2, 0, Math.PI * 1.5, Math.PI * 0.5, true);
    c.closePath();
  };

  c.save();
  outline();
  // 뒤판은 채우고, 앞판은 비쳐야 하니 아주 옅게만
  c.fillStyle = front ? 'rgba(214,166,112,0.34)' : '#d9a86e';
  c.fill();
  c.clip();

  // 위가 밝고 아래가 어둡다 — 이 하나로 평면이 원통이 된다
  const shade = c.createLinearGradient(0, g - H, 0, g);
  shade.addColorStop(0, `rgba(255,232,192,${front ? 0.34 : 0.5})`);
  shade.addColorStop(0.45, 'rgba(255,232,192,0)');
  shade.addColorStop(1, `rgba(110,70,38,${front ? 0.2 : 0.4})`);
  c.fillStyle = shade;
  c.fillRect(x - 2, g - H - 2, w + 4, H + 4);

  // 이음 고리 — 플라스틱 관의 마디. clip 안이라 지붕 위로 안 나간다.
  c.fillStyle = `rgba(150,102,58,${front ? 0.22 : 0.26})`;
  for (let i = 1; i < 9; i++) c.fillRect(x + (w / 9) * i, g - H - 2, 1.8, H + 4);
  // 유리 같은 빛줄기 하나
  c.fillStyle = `rgba(255,246,222,${front ? 0.3 : 0.42})`;
  c.fillRect(x, g - H + 3.5, w, 2.2);
  c.restore();

  // 입구 — 관 끝의 단면. 관 높이와 정확히 같아야 붙어 보인다.
  for (const mx of [x + MR, x + w - MR]) {
    c.fillStyle = front ? 'rgba(185,129,79,0.5)' : '#b9814f';
    c.beginPath();
    c.ellipse(mx, cy, MR, H / 2, 0, 0, Math.PI * 2);
    c.fill();
    if (!front) {
      // 비어 있을 때만 안쪽이 어둡다. 누가 들어가 있으면 그 애가 보여야 한다.
      c.fillStyle = '#5a3a22';
      c.beginPath();
      c.ellipse(mx, cy, MR - 1.6, H / 2 - 2.2, 0, 0, Math.PI * 2);
      c.fill();
    }
  }

  if (!front) {
    c.fillStyle = 'rgba(110,70,38,0.22)';
    c.fillRect(x + MR, g - 1.5, w - MR * 2, 1.5);
  }
}

export const FURNITURE: Record<FurnitureId, FurnitureDef> = {
  // ── 선반 ───────────────────────────────────────
  // 케이지에 '2층'을 만드는 물건. 이거 하나로 같은 방이 두 배가 된다.
  shelf: {
    id: 'shelf',
    name: '선반',
    w: 52,
    h: 50,
    affords: [],
    unlock: { kind: 'start' },
    platform: { height: 46, x0: 2, x1: 50 },
    /**
     * ★ 옆에 붙으면 그쪽 다리와 난간이 사라진다.
     *
     * 두 개를 나란히 놓으면 바닥 그래프는 이미 하나로 이어준다. 그런데 그림에
     * 다리가 네 개 서 있으면 눈에는 여전히 판 두 개다 — 가운데서 걸려 넘어질
     * 것처럼 보인다. **이어졌으면 이어져 보여야 한다.**
     *
     * 붙었는지는 [floors.ts]의 planksJoin이 판단한다. 여기서 따로 계산하면
     * 언젠가 어긋나서 '다리는 없는데 못 지나가는' 자리가 생긴다.
     */
    draw: (c, x, g, _t, _spin, joins) => {
      const y = g - 46;
      const l = joins?.l ?? false;
      const r = joins?.r ?? false;
      // 다리 — 이어진 쪽은 안 세운다
      if (!l) rect(c, x + 3, y + 3, 3, 43, '#8d5c35');
      if (!r) rect(c, x + 46, y + 3, 3, 43, '#8d5c35');
      // 상판 — 이어진 쪽으로는 이음매가 안 보이게 살짝 넘겨 그린다
      rect(c, x - (l ? 4 : 0), y - 3, 52 + (l ? 4 : 0) + (r ? 4 : 0), 4, '#d29865');
      rect(c, x - (l ? 4 : 0), y - 3, 52 + (l ? 4 : 0) + (r ? 4 : 0), 1, '#eab98b');
      rect(c, x - (l ? 4 : 0), y + 1, 52 + (l ? 4 : 0) + (r ? 4 : 0), 2, '#a97544');
      // 난간 (떨어지지 말라고) — 끝에만
      if (!l) rect(c, x, y - 9, 2, 7, '#c98f5a');
      if (!r) rect(c, x + 50, y - 9, 2, 7, '#c98f5a');
    },
  },

  // ── 사다리 ─────────────────────────────────────
  // 층과 층을 잇는다. 선반만 놓으면 못 올라간다 — 조합이 생기는 지점.
  ladder: {
    id: 'ladder',
    name: '사다리',
    w: 16,
    h: 52,
    affords: ['climb'],
    unlock: { kind: 'start' },
    climbHeight: 52,
    draw: (c, x, g) => {
      const top = g - 52;
      rect(c, x + 2, top, 3, 52, '#c98f5a');
      rect(c, x + 11, top, 3, 52, '#c98f5a');
      c.fillStyle = '#e0a86e';
      for (let y = top + 5; y < g - 2; y += 7) c.fillRect(x + 2, y, 12, 2);
      rect(c, x + 1, top, 14, 2, '#a97544');
    },
  },

  // ── 해먹 ───────────────────────────────────────
  hammock: {
    id: 'hammock',
    name: '해먹',
    w: 34,
    h: 26,
    affords: ['sleep'],
    unlock: { kind: 'day', day: 4 },
    anchor: 17,
    draw: (c, x, g) => {
      const top = g - 24;
      c.strokeStyle = '#b98c5c';
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(x + 2, top);
      c.lineTo(x + 6, top + 8);
      c.moveTo(x + 32, top);
      c.lineTo(x + 28, top + 8);
      c.stroke();
      c.fillStyle = '#e8a0a8';
      c.beginPath();
      c.moveTo(x + 5, top + 7);
      c.quadraticCurveTo(x + 17, top + 22, x + 29, top + 7);
      c.quadraticCurveTo(x + 17, top + 14, x + 5, top + 7);
      c.fill();
      c.fillStyle = '#f4bcc2';
      c.beginPath();
      c.moveTo(x + 6, top + 8);
      c.quadraticCurveTo(x + 17, top + 17, x + 28, top + 8);
      c.quadraticCurveTo(x + 17, top + 12, x + 6, top + 8);
      c.fill();
    },
  },

  // ── 나무집 ─────────────────────────────────────
  house: {
    id: 'house',
    name: '나무집',
    w: 54,
    h: 36,
    affords: ['sleep', 'hide'],
    unlock: { kind: 'start' },
    draw: (c, x, g) => {
      const top = g - 36;
      rect(c, x, top + 9, 54, 27, '#b47a4a');
      rect(c, x, g - 3, 54, 3, '#8d5c35');
      c.fillStyle = '#d29865';
      c.beginPath();
      c.moveTo(x - 5, top + 10);
      c.lineTo(x + 27, top - 4);
      c.lineTo(x + 59, top + 10);
      c.closePath();
      c.fill();
      rect(c, x - 5, top + 9, 64, 2, '#8d5c35');
      c.globalAlpha = 0.35;
      for (let i = 1; i < 4; i++) rect(c, x + 13.5 * i, top + 11, 1, 24, '#8d5c35');
      c.globalAlpha = 1;
      const bx = x + 27;
      c.fillStyle = '#6b452a';
      c.beginPath();
      c.moveTo(bx - 11, g);
      c.lineTo(bx - 11, g - 12);
      c.arc(bx, g - 12, 11, Math.PI, 0);
      c.lineTo(bx + 11, g);
      c.closePath();
      c.fill();
      c.fillStyle = '#4f3220';
      c.beginPath();
      c.moveTo(bx - 8, g);
      c.lineTo(bx - 8, g - 11);
      c.arc(bx, g - 11, 8, Math.PI, 0);
      c.lineTo(bx + 8, g);
      c.closePath();
      c.fill();
    },
  },

  // ── 밥그릇 ─────────────────────────────────────
  bowl: {
    id: 'bowl',
    name: '밥그릇',
    w: 20,
    h: 8,
    affords: ['eat'],
    unlock: { kind: 'start' },
    draw: (c, x, g) => {
      c.fillStyle = '#c9d8e0';
      c.beginPath();
      c.moveTo(x, g - 7);
      c.quadraticCurveTo(x + 10, g + 3, x + 20, g - 7);
      c.closePath();
      c.fill();
      c.fillStyle = '#e6f0f5';
      c.beginPath();
      c.ellipse(x + 10, g - 7, 10, 2.4, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#aebfc9';
      c.beginPath();
      c.ellipse(x + 10, g - 6.6, 7.5, 1.6, 0, 0, Math.PI * 2);
      c.fill();
    },
  },

  // ── 러닝휠 ─────────────────────────────────────
  /**
   * ── 러닝휠 ─────────────────────────────────────
   *
   * ★ 진짜로 탈 수 있어야 한다.
   *
   * 예전엔 지름 26짜리였다. 햄스터가 (배율 포함) 38쯤 되니 애초에 들어갈
   * 수가 없어서, '달리기'를 골라도 바퀴 **옆에 서서** 숨만 가빠졌다.
   * 안에 들어가려면 안지름이 몸보다 커야 한다 — 그래서 R을 26으로 키웠고
   * 바닥이 톱밥에 닿게 놨다. 그러면 햄스터는 제자리에 선 채로 바퀴가
   * 몸을 감싸고, 자리를 옮기는 코드가 한 줄도 필요 없다.
   *
   * ★ 그리고 앞테는 햄스터 **뒤에** 그리면 안 된다.
   *
   * 가구는 전부 햄스터보다 먼저 그려진다. 그래서 아무리 크게 만들어도
   * 햄스터가 바퀴 앞에 붙어 선 것처럼 보인다. 안에 들어간 것으로 보이려면
   * 가까운 쪽 테가 몸을 가로질러야 한다 — 그게 drawFront다.
   */
  wheel: {
    id: 'wheel',
    name: '러닝휠',
    w: 52,
    h: 54,
    affords: ['run'],
    unlock: { kind: 'signal', behavior: 'zoomie', count: 2 },
    anchor: 26,
    draw: (c, x, g, _t, spin = 0) => {
      const cx = x + 26;
      const cy = g - 26;
      const R = 25;
      // 받침대 — 바퀴가 톱밥에 놓인 물건으로 보이게
      rect(c, cx - 13, g - 3, 26, 3, '#8d7156');
      rect(c, cx - 13, g - 3, 26, 1, '#a68a6c');
      rect(c, cx - 2.5, cy + 8, 5, 15, '#a68a6c');

      // 뒤쪽 테 — 안쪽이 살짝 어두워야 통 안이 된다
      c.fillStyle = 'rgba(120,86,52,0.16)';
      c.beginPath();
      c.arc(cx, cy, R - 3, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#c98f5a';
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(cx, cy, R, 0, Math.PI * 2);
      c.stroke();

      // 살 — 뒤쪽 절반만. 앞쪽은 drawFront가 맡는다.
      c.strokeStyle = 'rgba(226,176,120,0.75)';
      c.lineWidth = 1.2;
      for (let i = 0; i < 10; i++) {
        const a = spin + (i * Math.PI) / 5;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * 4.5, cy + Math.sin(a) * 4.5);
        c.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2));
        c.stroke();
      }
      c.fillStyle = '#b07a4c';
      c.beginPath();
      c.arc(cx, cy, 4, 0, Math.PI * 2);
      c.fill();
    },
    drawFront: (c, x, g, _t: number, spin = 0) => {
      const cx = x + 26;
      const cy = g - 26;
      const R = 25;
      // 가까운 쪽 테 — 몸을 가로질러야 '안에 있다'가 된다
      c.strokeStyle = '#e0a86e';
      c.lineWidth = 2.6;
      c.beginPath();
      c.arc(cx, cy, R, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = '#f2c68e';
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(cx, cy, R, Math.PI * 1.1, Math.PI * 1.9);
      c.stroke();
      // 앞쪽 살은 옅게 — 진하면 햄스터가 안 보인다
      c.strokeStyle = 'rgba(242,198,142,0.34)';
      c.lineWidth = 1.1;
      for (let i = 0; i < 10; i++) {
        const a = spin + 0.31 + (i * Math.PI) / 5;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
        c.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2));
        c.stroke();
      }
      // 달리는 바닥 — 발밑에 가로대가 지나가야 굴러가는 게 보인다
      c.strokeStyle = 'rgba(176,122,76,0.5)';
      c.lineWidth = 1.6;
      for (let i = 0; i < 14; i++) {
        const a = spin * 1 + (i * Math.PI) / 7;
        const sx = cx + Math.cos(a) * (R - 1.5);
        const sy = cy + Math.sin(a) * (R - 1.5);
        if (sy < cy + R * 0.55) continue; // 바닥 쪽 조각만
        c.beginPath();
        c.moveTo(sx - 1.5, sy);
        c.lineTo(sx + 1.5, sy);
        c.stroke();
      }
    },
  },

  // ── 터널 ───────────────────────────────────────
  /**
   * ── 터널 ───────────────────────────────────────
   *
   * ★ 들어갈 수 있어야 터널이다.
   *
   * 42×14짜리였다. 햄스터가 38쯤 되니 애초에 못 들어가서, '숨기'를 골라도
   * 터널 **옆에 웅크리고** 있었다. 존재 이유가 없는 물건이었던 셈이다.
   *
   * 크기를 키우고, 몸통을 햄스터보다 **뒤에** 한 번 더 그린다(drawFront).
   * 그러면 안으로 걸어 들어가는 만큼 몸이 가려진다 — 들어가는 동작을 따로
   * 만들 필요가 없다. 걸어 들어가는 것이 곧 들어가는 동작이다.
   *
   * 이게 '사라졌다가 반대편에서 나온다'의 두 번째 자리다. 굴이 세로라면
   * 터널은 가로다.
   */
  tunnel: {
    id: 'tunnel',
    name: '터널',
    w: 64,
    h: 32,
    affords: ['hide'],
    unlock: { kind: 'signal', behavior: 'burrow', count: 5 },
    anchor: 32,
    tube: { x0: 8, x1: 56 },
    draw: (c, x, g) => tunnelBody(c, x, g),
    // 안에 있을 때만 한 번 더 덮는다 — 평소엔 햄스터가 앞으로 지나가야 한다
    drawFront: (c, x, g, _t, use = 0) => {
      if (use < 0.5) return;
      tunnelBody(c, x, g, true);
    },
  },

  // ── 구름침대 ───────────────────────────────────
  cloudbed: {
    id: 'cloudbed',
    name: '구름침대',
    w: 28,
    h: 13,
    affords: ['sleep'],
    unlock: { kind: 'day', day: 8 },
    draw: (c, x, g) => {
      c.fillStyle = '#f6f2fb';
      for (const [dx, dy, r] of [
        [6, -5, 6],
        [14, -7, 7.5],
        [22, -5, 6],
      ]) {
        c.beginPath();
        c.arc(x + dx, g + dy, r, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#e4dcf0';
      c.beginPath();
      c.ellipse(x + 14, g - 1.5, 14, 3.4, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fffdff';
      c.beginPath();
      c.ellipse(x + 14, g - 5.5, 8, 2.6, 0, 0, Math.PI * 2);
      c.fill();
    },
  },

  // ── 화분 ───────────────────────────────────────
  pot: {
    id: 'pot',
    name: '화분',
    w: 16,
    h: 22,
    affords: ['nibble'],
    unlock: { kind: 'season', season: 'spring' },
    draw: (c, x, g) => {
      c.fillStyle = '#5f9b52';
      for (const [dx, dy, rx, ry] of [
        [3, -13, 4.5, 2.6],
        [13, -15, 4.5, 2.6],
        [8, -19, 4, 3],
      ]) {
        c.beginPath();
        c.ellipse(x + dx, g + dy, rx, ry, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#4a7d42';
      rect(c, x + 7.5, g - 18, 1.4, 9, '#4a7d42');
      c.fillStyle = '#c2704f';
      c.beginPath();
      c.moveTo(x + 1, g - 10);
      c.lineTo(x + 15, g - 10);
      c.lineTo(x + 13, g);
      c.lineTo(x + 3, g);
      c.closePath();
      c.fill();
      rect(c, x, g - 11, 16, 2.4, '#d68a63');
    },
  },

  // ── 장난감 상자 ─────────────────────────────────
  toybox: {
    id: 'toybox',
    name: '장난감 상자',
    w: 22,
    h: 15,
    affords: ['climb', 'nibble'],
    unlock: { kind: 'day', day: 20 },
    draw: (c, x, g) => {
      rect(c, x, g - 12, 22, 12, '#c98f5a');
      rect(c, x, g - 15, 22, 4, '#e0a86e');
      rect(c, x, g - 15, 22, 1, '#f2c68e');
      rect(c, x + 9, g - 12, 4, 12, '#a97544');
      c.fillStyle = '#e58f8f';
      c.beginPath();
      c.arc(x + 5, g - 17, 3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#8fb8e5';
      c.beginPath();
      c.arc(x + 16, g - 18, 2.4, 0, Math.PI * 2);
      c.fill();
    },
  },

  /**
   * ── 급수기 ─────────────────────────────────────
   *
   * 밥그릇과 짝이다. 물 없이 사는 동물은 없으니 처음부터 있어야 하는 물건이고,
   * 없으면 사육장을 아는 사람 눈에 바로 빈다.
   *
   * ★ 물이 떨어지게 만들지 않았다.
   *
   * 물통이 비고 채워야 하는 건 얼핏 '돌봄'처럼 보이지만, 실제로는 잊으면
   * 벌을 받는 알람이다. 이 프로젝트는 "굶는 일은 없다"를 계약으로 걸어놨고
   * 목마름도 같은 자리에 있다. 물통은 늘 차 있고, 대신 마시러 오는 모습이
   * 예쁘면 그걸로 제 몫을 다한다.
   */
  water: {
    id: 'water',
    name: '급수기',
    w: 18,
    // 46(병) + 18(띄운 높이). 집기 판정이 실제 그림을 덮어야 해서 합쳐 적는다.
    h: 64,
    affords: ['drink'],
    unlock: { kind: 'start' },
    anchor: 9,
    mount: 'wall',
    /**
     * @param fill 남은 물 (1 = 가득, 0 = 바닥). 마시면 줄고, 놓아두면 다시 찬다.
     *
     * ★ 물이 떨어져도 벌은 없다. 마시는 동안만 줄고 알아서 다시 찬다.
     *   '채워주지 않으면 목마른' 물통은 돌봄처럼 보이지만 실은 알람이다.
     *   줄어드는 걸 보여주는 건 **마시고 있다는 표시**지 관리 대상이 아니다.
     */
    draw: (c, x, ground, t, fill = 1) => {
      const W = 18;
      /**
       * ★ 급수기는 톱밥에서 띄워 단다.
       *
       * 바닥에 닿게 그렸더니 꼭지가 톱밥에 파묻혀서, 벽에 건 물건이 아니라
       * 세워둔 물건으로 보였다. 실제 급수기는 위에 매달려 있고 햄스터가
       * 올려다보며 마신다 — 그래야 '서서 고개를 드는' 마시기 자세도 말이 된다.
       */
      const HANG = 18;
      const g = ground - HANG;
      // 오른쪽 벽에 걸렸으면 좌우를 뒤집는다 — 꼭지가 방 안쪽을 향해야 한다
      const flip = x + W / 2 > CAGE_W / 2;
      c.save();
      if (flip) {
        c.translate(x * 2 + W, 0);
        c.scale(-1, 1);
      }
      const top = g - 44;
      const wTop = top + 6 + (1 - fill) * (g - 20 - (top + 6));

      // 벽 걸이 — 바깥쪽(벽 쪽)에 붙는다
      c.fillStyle = '#7f8a92';
      c.fillRect(x - 2, top + 2, 4, 34);
      c.fillStyle = '#9aa6ae';
      c.fillRect(x - 2, top + 2, 4, 1.5);
      for (const by of [top + 5, g - 22]) {
        c.fillStyle = '#8a949b';
        c.fillRect(x - 2, by, W + 2, 3);
        c.fillStyle = '#b9c4cb';
        c.fillRect(x - 2, by, W + 2, 1);
      }

      // 유리병
      c.fillStyle = 'rgba(214,232,240,0.5)';
      c.beginPath();
      c.moveTo(x + 1, top);
      c.lineTo(x + W - 1, top);
      c.lineTo(x + W - 3, g - 16);
      c.lineTo(x + 3, g - 16);
      c.closePath();
      c.fill();

      // 담긴 물 — 수면이 fill 만큼 내려온다
      if (fill > 0.02) {
        c.fillStyle = 'rgba(126,178,204,0.72)';
        c.beginPath();
        c.moveTo(x + 2, wTop);
        c.lineTo(x + W - 2, wTop);
        c.lineTo(x + W - 3.5, g - 17);
        c.lineTo(x + 3.5, g - 17);
        c.closePath();
        c.fill();
        // 수면 — 아주 느리게 흔들린다
        c.fillStyle = 'rgba(200,230,242,0.95)';
        c.fillRect(x + 2, wTop - 0.5 + Math.sin(t * 0.0011) * 0.7, W - 4, 1.8);
      }
      // 유리 하이라이트
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(x + 3.5, top + 3, 1.6, g - 22 - top);

      // 뚜껑
      c.fillStyle = '#9aa6ae';
      c.fillRect(x, top - 4, W, 5);
      c.fillStyle = '#b9c4cb';
      c.fillRect(x, top - 4, W, 1.5);

      // 꼭지 — 이 물건의 얼굴. 방 안쪽으로 살짝 기운다.
      c.fillStyle = '#aab4bb';
      c.fillRect(x + W / 2 - 1.5, g - 17, 3, 11);
      c.fillStyle = '#c8d2d8';
      c.fillRect(x + W / 2 - 1.5, g - 17, 1.2, 11);
      c.fillStyle = '#8a949b';
      c.beginPath();
      c.arc(x + W / 2, g - 5.5, 2, 0, Math.PI * 2);
      c.fill();
      // 맺힌 물방울 — 마시는 중엔 굵어진다
      c.fillStyle = 'rgba(168,206,226,0.95)';
      c.beginPath();
      c.arc(x + W / 2, g - 3 + Math.sin(t * 0.0009) * 0.6, 1 + (1 - fill) * 0.8, 0, Math.PI * 2);
      c.fill();
      c.restore();
    },
  },

  // ══ 방의 모양을 바꾸는 것들 ═══════════════════════

  // ── 구름다리 ───────────────────────────────────
  // 선반보다 낮고 길다. 선반이 '2층'이라면 이건 '통로'다.
  // 두 개를 다른 높이로 놓으면 사다리 없이도 층이 생긴다.
  bridge: {
    id: 'bridge',
    name: '구름다리',
    w: 46,
    h: 30,
    affords: ['climb'],
    unlock: { kind: 'day', day: 6 },
    platform: { height: 26, x0: 3, x1: 43 },
    draw: (c, x, g, _t, _spin, joins) => {
      const y = g - 26;
      // 선반과 같은 규칙 — 이어진 쪽 기둥은 안 세운다
      const posts = [
        [x + 2, joins?.l ?? false],
        [x + 42, joins?.r ?? false],
      ] as const;
      for (const [px, joined] of posts) {
        if (joined) continue;
        rect(c, px, y, 2.5, 26, '#8d5c35');
        rect(c, px, y, 2.5, 1, '#b98a5c');
      }
      // 살짝 처진 판자 — 곧으면 다리가 아니라 선반이다
      for (let i = 0; i < 9; i++) {
        const px = x + 3 + i * 4.7;
        const sag = Math.sin((i / 8) * Math.PI) * 2.2;
        rect(c, px, y + sag, 4, 3.2, i % 2 === 0 ? '#d29865' : '#c78c58');
        rect(c, px, y + sag, 4, 0.8, '#eab98b');
      }
      // 밧줄
      c.strokeStyle = '#a97544';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + 3, y - 7);
      c.quadraticCurveTo(x + 23, y - 1, x + 43, y - 7);
      c.stroke();
    },
  },

  // ── 계단 ───────────────────────────────────────
  // 사다리와 같은 일을 하지만 생긴 게 다르다. 사다리는 수직이라 방을
  // 잘라먹고, 계단은 옆으로 눕는다 — 좁은 자리와 넓은 자리의 선택이 생긴다.
  stairs: {
    id: 'stairs',
    name: '계단',
    w: 34,
    h: 44,
    affords: ['climb'],
    unlock: { kind: 'signal', behavior: 'burrow', count: 3 },
    climbHeight: 42,
    draw: (c, x, g) => {
      for (let i = 0; i < 5; i++) {
        const sy = g - 8 - i * 8.5;
        const sx = x + i * 4;
        rect(c, sx, sy, 26 - i * 3, 4, '#d29865');
        rect(c, sx, sy, 26 - i * 3, 1, '#eab98b');
        rect(c, sx, sy + 4, 26 - i * 3, 2, '#a97544');
      }
      rect(c, x + 1, g - 8, 3, 8, '#8d5c35');
      rect(c, x + 21, g - 42, 3, 34, '#8d5c35');
    },
  },

  // ── 망루 ───────────────────────────────────────
  // 케이지에서 제일 높은 자리. 여기 올라가면 햄스터가 화면 위쪽에 선다 —
  // 위가 비어 있던 문제를 물건 하나로 푼다.
  tower: {
    id: 'tower',
    name: '망루',
    w: 30,
    h: 66,
    affords: ['climb'],
    unlock: { kind: 'day', day: 14 },
    platform: { height: 60, x0: 1, x1: 29 },
    climbHeight: 58,
    draw: (c, x, g) => {
      // 기둥 두 개와 가새
      rect(c, x + 4, g - 60, 3.5, 60, '#8d5c35');
      rect(c, x + 22, g - 60, 3.5, 60, '#8d5c35');
      c.strokeStyle = '#a97544';
      c.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const y0 = g - 8 - i * 18;
        c.beginPath();
        c.moveTo(x + 6, y0);
        c.lineTo(x + 24, y0 - 16);
        c.moveTo(x + 24, y0);
        c.lineTo(x + 6, y0 - 16);
        c.stroke();
      }
      // 꼭대기 발판
      rect(c, x, g - 63, 30, 4, '#d29865');
      rect(c, x, g - 63, 30, 1, '#eab98b');
      rect(c, x, g - 59, 30, 2, '#a97544');
      // 난간
      rect(c, x, g - 70, 2, 8, '#c98f5a');
      rect(c, x + 28, g - 70, 2, 8, '#c98f5a');
      // 지붕
      c.fillStyle = '#b5613f';
      c.beginPath();
      c.moveTo(x - 2, g - 70);
      c.lineTo(x + 15, g - 80);
      c.lineTo(x + 32, g - 70);
      c.closePath();
      c.fill();
    },
  },

  // ── 러그 ───────────────────────────────────────
  // 아무 기능도 없다. 여기 하나만 예외로 뒀다 — 바닥이 전부 톱밥색이라
  // 색을 놓을 자리가 한 군데는 있어야 방이 방처럼 보인다.
  rug: {
    id: 'rug',
    name: '러그',
    w: 38,
    h: 4,
    affords: [],
    unlock: { kind: 'day', day: 4 },
    draw: (c, x, g) => {
      c.fillStyle = '#b5613f';
      c.beginPath();
      c.ellipse(x + 19, g - 1, 19, 3.4, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#d08a63';
      c.beginPath();
      c.ellipse(x + 19, g - 1.4, 14, 2.4, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#eabf92';
      c.beginPath();
      c.ellipse(x + 19, g - 1.6, 7.5, 1.3, 0, 0, Math.PI * 2);
      c.fill();
      // 술
      c.fillStyle = '#c98f5a';
      for (const dx of [-19, -16, 16, 19]) c.fillRect(x + 19 + dx, g - 2.4, 1, 3);
    },
  },

  // ══ 행동을 바꾸는 것들 ════════════════════════════

  // ── 모래목욕통 ─────────────────────────────────
  // 실제 햄스터에게 이건 장난감이 아니라 필수품이다. 물로 안 씻고
  // 모래에 뒹굴어 씻는다. 굴 파기를 자주 하는 애에게 열린다 —
  // 파고 싶어하는 애한테 팔 자리를 주는 셈이라 신호와 보상이 맞아떨어진다.
  sandbath: {
    id: 'sandbath',
    name: '모래목욕통',
    w: 34,
    h: 16,
    affords: ['hide', 'sleep'],
    unlock: { kind: 'signal', behavior: 'burrow', count: 2 },
    anchor: 17,
    draw: (c, x, g) => {
      // 통
      c.fillStyle = '#cfd6dc';
      c.beginPath();
      c.moveTo(x + 1, g - 14);
      c.lineTo(x + 33, g - 14);
      c.lineTo(x + 30, g);
      c.lineTo(x + 4, g);
      c.closePath();
      c.fill();
      c.fillStyle = '#e6ebef';
      c.beginPath();
      c.moveTo(x + 1, g - 14);
      c.lineTo(x + 10, g - 14);
      c.lineTo(x + 12, g);
      c.lineTo(x + 4, g);
      c.closePath();
      c.fill();
      // 담긴 모래 — 가운데가 파여 있다
      c.fillStyle = '#efe2c2';
      c.beginPath();
      c.moveTo(x + 3, g - 11);
      c.quadraticCurveTo(x + 17, g - 5, x + 31, g - 11);
      c.lineTo(x + 31, g - 13);
      c.lineTo(x + 3, g - 13);
      c.closePath();
      c.fill();
      c.fillStyle = '#dccba4';
      for (let i = 0; i < 9; i++) {
        c.fillRect(x + 5 + i * 3, g - 11 + ((i * 7) % 3), 1, 1);
      }
      rect(c, x, g - 15, 34, 2, '#b7c0c8');
    },
  },

  // ── 원반 러너 ──────────────────────────────────
  // 쳇바퀴와 같은 '달리기'인데 등이 안 꺾인다. 실제로 이게 더 좋은 물건이다.
  // 쳇바퀴를 자주 타는 애에게 열린다.
  saucer: {
    id: 'saucer',
    name: '원반 러너',
    w: 32,
    h: 14,
    affords: ['run'],
    unlock: { kind: 'signal', behavior: 'zoomie', count: 3 },
    anchor: 16,
    draw: (c, x, g, t) => {
      /**
       * ★ 납작하면 접시지 러너가 아니다.
       *
       * 처음엔 타원 두 장으로 그렸더니 바닥에 놓인 원반으로만 보였다.
       * 실제 원반 러너는 **비스듬히 세워져 있다.** 한쪽 테두리를 올리고
       * 안쪽 면이 보이게 하면 그 각도가 생기고, 그제서야 '달리는 것'이 된다.
       */
      const spin = t * 0.9;
      rect(c, x + 13, g - 7, 6, 7, '#8d5c35');
      c.fillStyle = '#a97544';
      c.beginPath();
      c.ellipse(x + 16, g - 1, 10, 2.6, 0, 0, Math.PI * 2);
      c.fill();

      const cy = g - 13;
      // 바깥 테두리 (기울어진 원)
      c.fillStyle = '#c98f5a';
      c.beginPath();
      c.ellipse(x + 16, cy, 16, 9.5, -0.3, 0, Math.PI * 2);
      c.fill();
      // 안쪽 달리는 면 — 위로 살짝 밀어서 그릇 안이 보이게
      c.fillStyle = '#f2c68e';
      c.beginPath();
      c.ellipse(x + 16, cy + 1.6, 13.5, 7.4, -0.3, 0, Math.PI * 2);
      c.fill();
      // 안쪽 아래 그늘 — 오목해 보이는 유일한 단서
      c.fillStyle = 'rgba(140,92,52,0.28)';
      c.beginPath();
      c.ellipse(x + 16, cy + 3.4, 13, 5.6, -0.3, 0, Math.PI);
      c.fill();
      // 돌아가는 결
      c.strokeStyle = 'rgba(140,92,52,0.45)';
      c.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        const a = spin + (i / 7) * Math.PI * 2;
        c.beginPath();
        c.moveTo(x + 16 + Math.cos(a) * 4.5, cy + 1.6 + Math.sin(a) * 2.4);
        c.lineTo(x + 16 + Math.cos(a) * 12.5, cy + 1.6 + Math.sin(a) * 6.6);
        c.stroke();
      }
      // 위쪽 테두리 하이라이트
      c.strokeStyle = '#eab98b';
      c.lineWidth = 1.6;
      c.beginPath();
      c.ellipse(x + 16, cy, 15.2, 8.8, -0.3, Math.PI * 1.05, Math.PI * 1.95);
      c.stroke();
    },
  },

  // ── 씹기 나무 ──────────────────────────────────
  // 햄스터 이빨은 평생 자란다. 안 갈면 문제가 생긴다 — 필수품인데
  // 생긴 건 아주 소박하다. 그 대비가 좋다.
  chewBlock: {
    id: 'chewBlock',
    name: '씹기 나무',
    w: 18,
    h: 14,
    affords: ['nibble'],
    unlock: { kind: 'signal', behavior: 'wallScratch', count: 2 },
    draw: (c, x, g) => {
      rect(c, x + 1, g - 12, 16, 12, '#d9b98a');
      rect(c, x + 1, g - 12, 16, 2, '#eed3aa');
      rect(c, x + 1, g - 3, 16, 3, '#bd9a6c');
      // 나이테
      c.strokeStyle = '#bd9a6c';
      c.lineWidth = 0.8;
      for (const r of [2, 4.2, 6.4]) {
        c.beginPath();
        c.arc(x + 4, g - 6, r, -1.3, 1.3);
        c.stroke();
      }
      // 갉아먹은 자국 — 쓰이고 있다는 표시
      c.fillStyle = '#c9a97c';
      for (const [dx, dy] of [
        [15, -10],
        [16, -8],
        [14, -6.5],
      ] as const) {
        c.beginPath();
        c.arc(x + dx, g + dy, 1.6, 0, Math.PI * 2);
        c.fill();
      }
    },
  },

  // ── 건초 더미 ──────────────────────────────────
  // 숨을 수도 있고 씹을 수도 있다. 그리고 자리를 옮길 때마다 모양이
  // 달라 보이는 유일한 물건이다 — 부정형이라서.
  hayBale: {
    id: 'hayBale',
    name: '건초 더미',
    w: 28,
    h: 18,
    affords: ['hide', 'nibble', 'sleep'],
    unlock: { kind: 'season', season: 'autumn' },
    anchor: 14,
    draw: (c, x, g) => {
      c.fillStyle = '#d9c184';
      c.beginPath();
      c.ellipse(x + 14, g - 1, 14, 9, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = '#e8d5a8';
      c.beginPath();
      c.ellipse(x + 11, g - 1, 9.5, 6.5, 0, Math.PI, 0);
      c.fill();
      // 삐져나온 줄기 — 부정형의 핵심
      c.strokeStyle = '#c9ad6c';
      c.lineWidth = 1;
      for (let i = 0; i < 11; i++) {
        const t = i / 10;
        const bx = x + 1 + t * 26;
        const by = g - 2 - Math.sin(t * Math.PI) * 7;
        c.beginPath();
        c.moveTo(bx, by);
        c.lineTo(bx + (((i * 13) % 7) - 3), by - 3 - ((i * 5) % 4));
        c.stroke();
      }
      // 파고든 자리
      c.fillStyle = '#b99f60';
      c.beginPath();
      c.ellipse(x + 21, g - 2, 4, 2.6, 0, Math.PI, 0);
      c.fill();
    },
  },

  // ── 통나무 굴 ──────────────────────────────────
  // 터널과 같은 '숨기'인데 나무다. 터널이 플라스틱이라 방에서 튀는데,
  // 이건 벽·틀과 같은 나무색이라 다른 방 분위기가 나온다.
  logTunnel: {
    id: 'logTunnel',
    name: '통나무 굴',
    w: 36,
    h: 18,
    affords: ['hide', 'nibble'],
    unlock: { kind: 'day', day: 9 },
    anchor: 18,
    draw: (c, x, g) => {
      // 몸통
      c.fillStyle = '#a97544';
      c.beginPath();
      c.ellipse(x + 18, g - 8, 18, 8.5, 0, Math.PI, 0);
      c.fill();
      rect(c, x, g - 8, 36, 8, '#a97544');
      // 껍질 결
      c.fillStyle = '#8d5c35';
      for (let i = 0; i < 7; i++) c.fillRect(x + 2 + i * 5, g - 15, 1.4, 14);
      // 입구
      c.fillStyle = '#c99a68';
      c.beginPath();
      c.ellipse(x + 4, g - 8, 3.5, 7.5, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#4a3524';
      c.beginPath();
      c.ellipse(x + 4, g - 8, 2.2, 5.8, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#c99a68';
      c.beginPath();
      c.ellipse(x + 33, g - 8, 3.2, 7, 0, 0, Math.PI * 2);
      c.fill();
    },
  },

  // ── 찻잔 ───────────────────────────────────────
  // 사람 물건을 그대로 쓰는 것 — 그게 이 방의 이야기다.
  // 남는 찻잔 하나를 넣어줬더니 거기서 자기 시작한 것.
  teacup: {
    id: 'teacup',
    name: '찻잔',
    w: 24,
    h: 18,
    affords: ['sleep', 'hide'],
    unlock: { kind: 'day', day: 11 },
    anchor: 11,
    draw: (c, x, g) => {
      // 받침
      c.fillStyle = '#e8e0d2';
      c.beginPath();
      c.ellipse(x + 11, g - 1, 12, 3, 0, 0, Math.PI * 2);
      c.fill();
      // 손잡이
      c.strokeStyle = '#f2ece0';
      c.lineWidth = 2.6;
      c.beginPath();
      c.arc(x + 20, g - 8, 4, -1.2, 1.2);
      c.stroke();
      // 잔 — 살짝 눕혀 두면 들어가 눕는 물건이 된다
      c.fillStyle = '#f6f1e6';
      c.beginPath();
      c.moveTo(x + 1, g - 14);
      c.quadraticCurveTo(x + 11, g + 2, x + 20, g - 14);
      c.closePath();
      c.fill();
      c.fillStyle = '#ded5c4';
      c.beginPath();
      c.ellipse(x + 10.5, g - 14, 9.5, 3, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#c9bfae';
      c.beginPath();
      c.ellipse(x + 10.5, g - 13.4, 8, 2.2, 0, 0, Math.PI * 2);
      c.fill();
      // 파란 띠
      c.fillStyle = '#8fa8c4';
      c.beginPath();
      c.ellipse(x + 10.5, g - 11.6, 8.6, 2.4, 0, 0.15, Math.PI - 0.15);
      c.fill();
    },
  },
};

export const FURNITURE_IDS = Object.keys(FURNITURE) as FurnitureId[];

/** 가구 위/안에서 햄스터가 자리잡는 x (가구 왼쪽 기준 중심) */
export function anchorOf(def: FurnitureDef): number {
  return def.anchor ?? def.w / 2;
}
