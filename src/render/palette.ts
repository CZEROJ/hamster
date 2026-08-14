/**
 * 고정 팔레트.
 * 색을 24개로 묶어두면 (1) 나중에 아트를 누가 그려도 톤이 안 깨지고
 * (2) 계절별 색 보정을 팔레트 스왑 한 번으로 처리할 수 있다.
 */
export const P = {
  wallTop: '#f8e6d6',
  wallMid: '#f2d8c1',
  wallLow: '#e9c8ab',
  wallLine: '#dcb193',

  beddingTop: '#f4dfae',
  bedding: '#e9cd93',
  beddingDark: '#d6b678',
  beddingSpeck: '#c9a468',

  woodLight: '#d29865',
  wood: '#b47a4a',
  woodDark: '#8d5c35',

  frame: '#a97f58',
  frameLight: '#c99d74',
  glass: 'rgba(255,255,255,0.10)',

  furLight: '#fbe4bd',
  fur: '#f2d09a',
  furShade: '#dfb479',
  furBelly: '#fdf4e3',
  earInner: '#e2a290',
  eye: '#4b332a',
  eyeGlint: '#fffaf0',
  nose: '#d98d8d',
  blush: 'rgba(240,150,145,0.35)',

  shadow: 'rgba(180,135,95,0.28)',
  touch: 'rgba(255,246,225,0.55)',
} as const;
