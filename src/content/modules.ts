/**
 * 모듈의 외형과 바닥재.
 *
 * 모듈 크기는 전부 같다. 다양성은 '모양'이 아니라 '재질과 바닥재'에서 나온다.
 * 크기를 다르게 만들면 격자가 무너지고 튜브 연결이 지옥이 된다 —
 * 그리고 실제 모듈형 사육장도 같은 규격을 이어 붙이는 방식이다.
 */

export type ShellId = 'glass' | 'wood' | 'plastic' | 'sage';
export type SubstrateId = 'wood' | 'paper' | 'sand' | 'moss';

export interface Shell {
  id: ShellId;
  name: string;
  frame: string;
  frameLight: string;
  frameDark: string;
  wallTop: string;
  wallLow: string;
}

export const SHELLS: Record<ShellId, Shell> = {
  glass: {
    id: 'glass',
    name: '유리 수조',
    frame: '#a97f58',
    frameLight: '#c99d74',
    frameDark: '#8a6444',
    wallTop: '#f8e6d6',
    wallLow: '#eac9ac',
  },
  wood: {
    id: 'wood',
    name: '나무 상자',
    frame: '#8d5c35',
    frameLight: '#b07a4c',
    frameDark: '#6d4526',
    wallTop: '#e8cfae',
    wallLow: '#d4b48c',
  },
  /**
   * ★ 예전엔 이게 차가운 하늘색이었다.
   *
   * 화면에서 제일 먼저 눈에 들어오면서 나머지 따뜻한 갈색을 전부 죽였다.
   * 이 게임의 색은 '따뜻한 파스텔'이고, 그 안에서 다양성을 만들어야지
   * 팔레트 바깥으로 나가서 만들면 그 방 하나가 화면을 망친다.
   * 채도를 낮춘 장밋빛으로 옮겼다 — 갈색과 같은 온도라서 옆에 놔도 안 싸운다.
   */
  plastic: {
    id: 'plastic',
    name: '분홍 통',
    frame: '#c49a94',
    frameLight: '#dcb8b2',
    frameDark: '#a07a74',
    wallTop: '#fbeee9',
    wallLow: '#f0dcd4',
  },
  // 노란기가 도는 연둣빛. 파란 쪽으로 가면 갈색과 싸우고, 이쪽이면 같이 앉는다.
  sage: {
    id: 'sage',
    name: '연둣빛 통',
    frame: '#94a37a',
    frameLight: '#b2bf96',
    frameDark: '#76855f',
    wallTop: '#f1f2e2',
    wallLow: '#dfe3c9',
  },
};

export interface Substrate {
  id: SubstrateId;
  name: string;
  top: string;
  body: string;
  dark: string;
  speck: string;
}

/**
 * 바닥재는 방마다 따로 고른다.
 * 코드 몇 줄로 방 전체의 인상이 바뀌는, 투자 대비 효율이 제일 좋은 꾸미기 축이다.
 */
export const SUBSTRATES: Record<SubstrateId, Substrate> = {
  wood: {
    id: 'wood',
    name: '톱밥',
    top: '#f4dfae',
    body: '#e9cd93',
    dark: '#d6b678',
    speck: '#c9a468',
  },
  // 거의 흰색이라 톱밥이 아니라 눈처럼 보였다. 크림 쪽으로 당겼다.
  paper: {
    id: 'paper',
    name: '종이',
    top: '#f7e9d8',
    body: '#ecdac4',
    dark: '#d9c3a8',
    speck: '#fff6e8',
  },
  sand: {
    id: 'sand',
    name: '모래',
    top: '#f6e6c4',
    body: '#ecd6a8',
    dark: '#d9be8c',
    speck: '#fff4dc',
  },
  moss: {
    id: 'moss',
    name: '이끼',
    top: '#c2d9a4',
    body: '#a8c489',
    dark: '#8ba86e',
    speck: '#dcecc4',
  },
};

export const SHELL_IDS = Object.keys(SHELLS) as ShellId[];
export const SUBSTRATE_IDS = Object.keys(SUBSTRATES) as SubstrateId[];
