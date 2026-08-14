/**
 * 먹이.
 *
 * ★ 설계의 핵심: 좋아하는 음식을 미리 정해두지 않는다.
 *   숨겨둔 정답은 추측 게임이지 성격이 아니다.
 *   취향은 [prefs.ts]에서 '실제로 무엇을 먹었는가'로부터 형성된다.
 *   그래야 "비 오는 날 같이 먹어서 딸기를 좋아하게 됐다"는 사연이 생긴다.
 */
/**
 * ★ 스무 가지인 이유는 '다 먹여보라'가 아니다.
 *
 * 취향은 미리 정해져 있지 않고 실제로 먹인 기록에서 자란다([prefs.ts]).
 * 그러니까 가짓수가 곧 **가능한 사연의 가짓수**다. 여섯 가지면 첫 주에
 * 다 먹여보고 취향이 굳어버리지만, 스무 가지면 몇 달 뒤에도 "얘 호박씨는
 * 처음 먹어보네" 하는 날이 남아 있다.
 *
 * 실제 햄스터가 먹는 것만 넣었다. 초콜릿이나 감귤 같은 건 넣지 않았다 —
 * 잘 돌보는 이야기를 하면서 먹이면 안 되는 걸 먹이게 하면 안 된다.
 */
export type FoodId =
  | 'sunflower'
  | 'apple'
  | 'broccoli'
  | 'strawberry'
  | 'walnut'
  | 'cheese'
  | 'pumpkinSeed'
  | 'corn'
  | 'carrot'
  | 'cucumber'
  | 'blueberry'
  | 'banana'
  | 'peanut'
  | 'oat'
  | 'pea'
  | 'millet'
  | 'mealworm'
  | 'egg'
  | 'yogurtDrop'
  | 'dandelion';

export interface Food {
  id: FoodId;
  name: string;
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void;
}

const ell = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  c: string,
) => {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.4, rx), Math.max(0.4, ry), 0, 0, Math.PI * 2);
  ctx.fill();
};

export const FOODS: Record<FoodId, Food> = {
  sunflower: {
    id: 'sunflower',
    name: '해바라기씨',
    draw: (c, x, y, s) => {
      ell(c, x, y, 2.2 * s, 3.2 * s, '#5a4630');
      ell(c, x - 0.5 * s, y - 0.6 * s, 1.1 * s, 1.8 * s, '#7d6444');
      c.fillStyle = '#efe3cf';
      c.fillRect(x - 1.6 * s, y - 1.2 * s, 0.8 * s, 3 * s);
    },
  },
  apple: {
    id: 'apple',
    name: '사과',
    draw: (c, x, y, s) => {
      ell(c, x, y + 0.4 * s, 3.4 * s, 3.2 * s, '#d8544c');
      ell(c, x - 1.1 * s, y - 0.8 * s, 1.3 * s, 1.1 * s, '#ec7d72');
      c.fillStyle = '#7a5a34';
      c.fillRect(x - 0.4 * s, y - 3.6 * s, 0.9 * s, 1.6 * s);
      ell(c, x + 1.6 * s, y - 3.2 * s, 1.4 * s, 0.8 * s, '#7db85e');
    },
  },
  broccoli: {
    id: 'broccoli',
    name: '브로콜리',
    draw: (c, x, y, s) => {
      c.fillStyle = '#cfd9a8';
      c.fillRect(x - 0.8 * s, y - 0.5 * s, 1.7 * s, 3.4 * s);
      ell(c, x, y - 1.4 * s, 3.3 * s, 2.3 * s, '#5c9a4c');
      ell(c, x - 1.4 * s, y - 2.2 * s, 1.5 * s, 1.3 * s, '#78b463');
      ell(c, x + 1.3 * s, y - 1.8 * s, 1.3 * s, 1.1 * s, '#78b463');
    },
  },
  strawberry: {
    id: 'strawberry',
    name: '딸기',
    draw: (c, x, y, s) => {
      c.fillStyle = '#e0524f';
      c.beginPath();
      c.moveTo(x - 2.8 * s, y - 1.6 * s);
      c.quadraticCurveTo(x, y + 4.4 * s, x + 2.8 * s, y - 1.6 * s);
      c.quadraticCurveTo(x, y - 3.4 * s, x - 2.8 * s, y - 1.6 * s);
      c.fill();
      ell(c, x + 0.2 * s, y - 2.4 * s, 2.4 * s, 0.9 * s, '#6aa84f');
      c.fillStyle = '#ffe9b0';
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0.6],
        [0, 1.6],
      ]) {
        c.fillRect(x + dx * s, y + dy * s, 0.7 * s, 0.7 * s);
      }
    },
  },
  walnut: {
    id: 'walnut',
    name: '호두',
    draw: (c, x, y, s) => {
      ell(c, x, y, 3.3 * s, 3 * s, '#a97a4c');
      ell(c, x, y, 2.4 * s, 2.2 * s, '#c99a68');
      c.fillStyle = '#8f6238';
      c.fillRect(x - 0.4 * s, y - 2.6 * s, 0.8 * s, 5.2 * s);
      ell(c, x - 1.3 * s, y - 0.4 * s, 0.8 * s, 1.4 * s, '#b98c5c');
    },
  },
  cheese: {
    id: 'cheese',
    name: '치즈',
    draw: (c, x, y, s) => {
      // 정면 쐐기
      c.fillStyle = '#f0c65a';
      c.beginPath();
      c.moveTo(x - 3.6 * s, y + 2.6 * s);
      c.lineTo(x + 3.6 * s, y + 2.6 * s);
      c.lineTo(x + 3.6 * s, y - 2.6 * s);
      c.closePath();
      c.fill();
      // 윗면
      c.fillStyle = '#ffe08a';
      c.beginPath();
      c.moveTo(x - 3.6 * s, y + 2.6 * s);
      c.lineTo(x + 3.6 * s, y - 2.6 * s);
      c.lineTo(x + 2.2 * s, y - 3.4 * s);
      c.lineTo(x - 4.6 * s, y + 1.8 * s);
      c.closePath();
      c.fill();
      // 구멍
      c.fillStyle = '#d8a33f';
      c.beginPath();
      c.arc(x + 1.4 * s, y + 1 * s, 0.8 * s, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(x + 2.6 * s, y - 0.6 * s, 0.55 * s, 0, Math.PI * 2);
      c.fill();
    },
  },

  // ── 씨앗·곡물 ──────────────────────────────────
  pumpkinSeed: {
    id: 'pumpkinSeed',
    name: '호박씨',
    draw: (c, x, y, s) => {
      // 톱밥 위에 놓이니까 테두리가 진해야 보인다 — 크림색끼리 붙으면 사라진다
      ell(c, x, y, 2.6 * s, 3.3 * s, '#a08b5c');
      ell(c, x, y, 2.1 * s, 2.8 * s, '#f3ecd2');
      ell(c, x - 0.5 * s, y - 0.6 * s, 1.1 * s, 1.5 * s, '#fffdf4');
      c.fillStyle = '#c4b184';
      c.fillRect(x - 1.3 * s, y - 1.6 * s, 0.5 * s, 3.4 * s);
    },
  },
  peanut: {
    id: 'peanut',
    name: '땅콩',
    draw: (c, x, y, s) => {
      ell(c, x, y - 1.6 * s, 2.5 * s, 2.2 * s, '#d9b381');
      ell(c, x, y + 1.6 * s, 2.7 * s, 2.4 * s, '#d9b381');
      ell(c, x - 0.6 * s, y - 2 * s, 1.3 * s, 1.1 * s, '#ecd0a6');
      c.fillStyle = '#b98f5d';
      for (let i = -2; i <= 2; i++) c.fillRect(x - 2.2 * s, y + i * 1.3 * s, 4.4 * s, 0.4 * s);
    },
  },
  oat: {
    id: 'oat',
    name: '귀리',
    draw: (c, x, y, s) => {
      c.fillStyle = '#c9b184';
      c.fillRect(x - 0.3 * s, y - 3 * s, 0.6 * s, 6 * s);
      for (const [dx, dy] of [
        [-1.6, -1.8],
        [1.6, -1.1],
        [-1.6, 0.4],
        [1.6, 1.1],
        [-1.3, 2.4],
      ] as const) {
        ell(c, x + dx * s, y + dy * s, 1.5 * s, 0.9 * s, '#e8d5a8');
        ell(c, x + dx * s * 0.9, y + dy * s - 0.2 * s, 0.9 * s, 0.5 * s, '#f6ead0');
      }
    },
  },
  millet: {
    id: 'millet',
    name: '좁쌀 이삭',
    draw: (c, x, y, s) => {
      // 처음엔 알갱이를 흩뿌렸더니 거의 안 보였다. 이삭은 '덩어리'로 먼저
      // 읽히고 알갱이는 그 위의 무늬여야 한다.
      c.fillStyle = '#a88c52';
      c.fillRect(x - 0.4 * s, y + 0.6 * s, 0.8 * s, 3.4 * s);
      ell(c, x, y - 1 * s, 2.3 * s, 3.4 * s, '#c9ab5e');
      ell(c, x - 0.5 * s, y - 1.4 * s, 1.5 * s, 2.6 * s, '#e7cd7e');
      c.fillStyle = '#f6e6ab';
      for (let i = 0; i < 13; i++) {
        const t = i / 12;
        const w = Math.sin(t * Math.PI) * 1.5;
        c.fillRect(
          x + ((((i * 7) % 3) - 1) * w - 0.4) * s,
          y - 4 * s + t * 5.6 * s,
          0.9 * s,
          0.9 * s,
        );
      }
    },
  },

  // ── 채소 ───────────────────────────────────────
  corn: {
    id: 'corn',
    name: '옥수수',
    draw: (c, x, y, s) => {
      // 껍질을 통째로 옆에 세웠더니 알맹이를 가렸다. 뒤로 빼고 한 장만 남긴다.
      ell(c, x + 1.8 * s, y + 1.4 * s, 1.2 * s, 3 * s, '#7d9a52');
      ell(c, x, y, 2.5 * s, 3.8 * s, '#e8b840');
      // 알맹이 — 격자로 찍어야 옥수수로 읽힌다
      c.fillStyle = '#ffe08a';
      for (let r = -3; r <= 3; r++) {
        const w = Math.sqrt(Math.max(0, 1 - (r / 3.6) ** 2)) * 2.1;
        for (let k = -2; k <= 2; k++) {
          const px = x + (k * 0.95 + (r % 2) * 0.45) * s;
          if (Math.abs(px - x) > w * s) continue;
          c.fillRect(px - 0.35 * s, y + r * 1.05 * s - 0.35 * s, 0.8 * s, 0.8 * s);
        }
      }
      ell(c, x - 1.6 * s, y - 1.6 * s, 0.7 * s, 1.4 * s, '#fff0c2');
    },
  },
  carrot: {
    id: 'carrot',
    name: '당근',
    draw: (c, x, y, s) => {
      c.fillStyle = '#e07f3c';
      c.beginPath();
      c.moveTo(x - 2.2 * s, y - 2.4 * s);
      c.lineTo(x + 2.2 * s, y - 2.4 * s);
      c.lineTo(x + 0.4 * s, y + 3.8 * s);
      c.closePath();
      c.fill();
      c.fillStyle = '#f09c5c';
      c.beginPath();
      c.moveTo(x - 1.4 * s, y - 2.4 * s);
      c.lineTo(x - 0.2 * s, y - 2.4 * s);
      c.lineTo(x - 0.2 * s, y + 2.2 * s);
      c.closePath();
      c.fill();
      for (const dx of [-1.4, 0, 1.4]) {
        ell(c, x + dx * s, y - 3.4 * s, 0.9 * s, 1.5 * s, '#6f9a4a');
      }
    },
  },
  cucumber: {
    id: 'cucumber',
    name: '오이',
    draw: (c, x, y, s) => {
      ell(c, x, y, 3.6 * s, 2.1 * s, '#7ea85c');
      ell(c, x, y, 2.6 * s, 1.4 * s, '#cfe0ac');
      c.fillStyle = '#eef3dc';
      for (const [dx, dy] of [
        [-0.9, -0.2],
        [0.5, 0.3],
        [1.4, -0.4],
      ] as const) {
        ell(c, x + dx * s, y + dy * s, 0.4 * s, 0.6 * s, '#eef3dc');
      }
      ell(c, x - 1 * s, y - 1.2 * s, 1.6 * s, 0.5 * s, '#9cc177');
    },
  },
  pea: {
    id: 'pea',
    name: '완두콩',
    draw: (c, x, y, s) => {
      c.fillStyle = '#8fb85e';
      c.beginPath();
      c.moveTo(x - 3.6 * s, y + 0.4 * s);
      c.quadraticCurveTo(x, y + 3.4 * s, x + 3.6 * s, y - 0.6 * s);
      c.quadraticCurveTo(x, y + 1 * s, x - 3.6 * s, y + 0.4 * s);
      c.fill();
      for (const dx of [-1.7, 0, 1.7]) {
        ell(c, x + dx * s, y - 0.4 * s - dx * 0.25 * s, 1.2 * s, 1.2 * s, '#a8cf72');
        ell(c, x + dx * s - 0.3 * s, y - 0.8 * s - dx * 0.25 * s, 0.5 * s, 0.4 * s, '#d3e8b2');
      }
    },
  },
  dandelion: {
    id: 'dandelion',
    name: '민들레잎',
    draw: (c, x, y, s) => {
      /**
       * 부드러운 곡선으로 그렸더니 그냥 초록 덩어리였다. 민들레잎은
       * **톱니**로 알아본다 — 뾰족한 삼각형을 좌우로 번갈아 물려야 잎이 된다.
       */
      c.fillStyle = '#6f9a4a';
      c.beginPath();
      c.moveTo(x, y + 3.8 * s);
      for (const side of [-1, 1]) {
        const seq = side === -1 ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
        for (const i of seq) {
          const t = i / 4;
          const ty = y + 3.8 * s - t * 7.4 * s;
          const tw = (0.5 + Math.sin(t * 2.6) * 1.9) * s;
          c.lineTo(x + side * tw, ty + 0.7 * s);
          c.lineTo(x + side * 0.5 * s, ty - 0.5 * s);
        }
      }
      c.closePath();
      c.fill();
      c.fillStyle = '#9cc177';
      c.fillRect(x - 0.35 * s, y - 3.6 * s, 0.7 * s, 7.4 * s);
      ell(c, x, y + 3.8 * s, 0.9 * s, 0.7 * s, '#c9d9a0');
    },
  },

  // ── 과일 ───────────────────────────────────────
  blueberry: {
    id: 'blueberry',
    name: '블루베리',
    draw: (c, x, y, s) => {
      ell(c, x - 1.2 * s, y + 0.8 * s, 2.2 * s, 2.1 * s, '#5b6a9c');
      ell(c, x + 1.4 * s, y - 0.4 * s, 2.5 * s, 2.4 * s, '#6c7cb0');
      ell(c, x + 0.7 * s, y - 1.2 * s, 1.1 * s, 0.8 * s, '#9aa7d4');
      c.fillStyle = '#48548a';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        c.fillRect(x + 1.4 * s + Math.cos(a) * 0.9 * s, y - 1.4 * s + Math.sin(a) * 0.6 * s, 0.5 * s, 0.5 * s);
      }
    },
  },
  banana: {
    id: 'banana',
    name: '바나나',
    draw: (c, x, y, s) => {
      c.fillStyle = '#eccd5c';
      c.beginPath();
      c.moveTo(x - 3.4 * s, y - 1.8 * s);
      c.quadraticCurveTo(x + 0.4 * s, y + 3.6 * s, x + 3.4 * s, y - 0.4 * s);
      c.quadraticCurveTo(x + 0.6 * s, y + 1.8 * s, x - 3.4 * s, y - 1.8 * s);
      c.fill();
      c.fillStyle = '#f8e58f';
      c.beginPath();
      c.moveTo(x - 3 * s, y - 1.6 * s);
      c.quadraticCurveTo(x + 0.2 * s, y + 2.4 * s, x + 2.4 * s, y - 0.4 * s);
      c.quadraticCurveTo(x + 0.4 * s, y + 1.4 * s, x - 3 * s, y - 1.6 * s);
      c.fill();
      c.fillStyle = '#8f6238';
      c.fillRect(x - 3.8 * s, y - 2.4 * s, 1 * s, 1 * s);
    },
  },

  // ── 특별한 것 ──────────────────────────────────
  // 실제로 햄스터가 좋아하는 단백질. 사람 눈엔 좀 그래도 이게 맞다.
  mealworm: {
    id: 'mealworm',
    name: '말린 밀웜',
    draw: (c, x, y, s) => {
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        ell(
          c,
          x - 2.8 * s + t * 5.6 * s,
          y + Math.sin(t * 3.2) * 1.2 * s,
          1 * s,
          1.1 * s,
          i % 2 === 0 ? '#c79a5e' : '#b3854b',
        );
      }
      ell(c, x + 2.9 * s, y + Math.sin(3.2) * 1.2 * s, 0.9 * s, 0.9 * s, '#8f6238');
    },
  },
  egg: {
    id: 'egg',
    name: '삶은 달걀',
    draw: (c, x, y, s) => {
      ell(c, x, y, 3 * s, 3.4 * s, '#fbf3e4');
      ell(c, x - 0.9 * s, y - 1 * s, 1.3 * s, 1.5 * s, '#ffffff');
      ell(c, x + 0.2 * s, y + 0.4 * s, 1.6 * s, 1.5 * s, '#f0c65a');
      ell(c, x - 0.2 * s, y + 0.1 * s, 0.7 * s, 0.6 * s, '#ffe08a');
    },
  },
  yogurtDrop: {
    id: 'yogurtDrop',
    name: '요거트 방울',
    draw: (c, x, y, s) => {
      ell(c, x, y + 0.6 * s, 2.8 * s, 2.4 * s, '#f6efe6');
      c.fillStyle = '#f6efe6';
      c.beginPath();
      c.moveTo(x - 2.8 * s, y + 0.6 * s);
      c.quadraticCurveTo(x, y - 4 * s, x + 2.8 * s, y + 0.6 * s);
      c.fill();
      ell(c, x - 0.9 * s, y - 0.6 * s, 0.9 * s, 1.1 * s, '#ffffff');
      ell(c, x, y + 2.6 * s, 2.8 * s, 0.7 * s, '#e0d5c6');
    },
  },
};

export const FOOD_IDS = Object.keys(FOODS) as FoodId[];
