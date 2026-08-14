/**
 * 털색.
 *
 * 내 햄스터는 골든 하나로 영원히 고정이다. 손님들만 색이 다르다.
 * 그래서 화면에 여러 마리가 있어도 '누가 내 애인지'가 0.1초 만에 구분된다.
 * 이게 흐려지면 '내 햄스터'라는 감각 전체가 무너진다.
 *
 * ★ 이름이 아니라 인상이다.
 *
 * 손님에게는 이름을 안 붙인다. '몽실이'가 아니라 '하얀 애'다. 이름은 내
 * 햄스터만 갖는다 — 이름을 붙이는 순간 가족이 되는데, 손님은 가족이 아니라
 * 날씨여야 한다. 왔다가 간다.
 *
 * ★ 스무 가지인 이유.
 *
 * 손님은 며칠에 한 번 온다. 여섯 가지뿐이면 두 주 만에 다 보고, 그 뒤로는
 * 손님이 와도 '또 걔'가 된다. 스무 가지면 몇 달을 봐도 처음 보는 색이 나온다.
 * 다 모으라고 스무 가지인 게 아니라, **처음 보는 애가 계속 있으라고** 그렇다.
 */
export type BreedId =
  | 'golden'
  | 'white'
  | 'grey'
  | 'panda'
  | 'cream'
  | 'calico'
  | 'black'
  | 'sable'
  | 'chocolate'
  | 'cinnamon'
  | 'silver'
  | 'dove'
  | 'honey'
  | 'apricot'
  | 'lilac'
  | 'smoke'
  | 'champagne'
  | 'roan'
  | 'banded'
  | 'agouti';

export interface Coat {
  id: BreedId;
  /** 일기에서 부르는 말 — 이름이 아니라 인상이다 */
  name: string;
  light: string;
  base: string;
  shade: string;
  belly: string;
  ear: string;
}

export const COATS: Record<BreedId, Coat> = {
  golden: {
    id: 'golden',
    name: '나',
    light: '#fbe4bd',
    base: '#f2d09a',
    shade: '#dfb479',
    belly: '#fdf4e3',
    ear: '#e2a290',
  },
  white: {
    id: 'white',
    name: '하얀 애',
    light: '#fffdfa',
    base: '#f4eee6',
    shade: '#ddd4c8',
    belly: '#ffffff',
    ear: '#f0bcb0',
  },
  grey: {
    id: 'grey',
    name: '회색 애',
    light: '#d8d4cd',
    base: '#b9b4ac',
    shade: '#98938b',
    belly: '#efece6',
    ear: '#c9a29a',
  },
  panda: {
    id: 'panda',
    name: '얼룩이',
    light: '#e8e4de',
    base: '#6f6a64',
    shade: '#4e4a45',
    belly: '#f6f3ee',
    ear: '#8f7c74',
  },
  cream: {
    id: 'cream',
    name: '연한 애',
    light: '#fff2dc',
    base: '#f7e3c0',
    shade: '#e2c9a0',
    belly: '#fffaf0',
    ear: '#eab6a4',
  },
  calico: {
    id: 'calico',
    name: '세 가지 색 애',
    light: '#f7e0c0',
    base: '#d99a63',
    shade: '#a86a44',
    belly: '#fdf2e4',
    ear: '#e0a08c',
  },

  // ── 여기서부터는 좀처럼 안 오는 애들 ────────────────
  black: {
    id: 'black',
    name: '까만 애',
    light: '#6f6a64',
    base: '#43403c',
    shade: '#2c2926',
    belly: '#8f8880',
    ear: '#7c605b',
  },
  sable: {
    id: 'sable',
    name: '그을린 애',
    light: '#bb9d7a',
    base: '#80634a',
    shade: '#594334',
    belly: '#e3cfb2',
    ear: '#aa7b6d',
  },
  chocolate: {
    id: 'chocolate',
    name: '초콜릿색 애',
    light: '#ab7c57',
    base: '#7e5437',
    shade: '#5b3b25',
    belly: '#dabd99',
    ear: '#b17967',
  },
  cinnamon: {
    id: 'cinnamon',
    name: '계피색 애',
    light: '#f0c79a',
    base: '#d99f6a',
    shade: '#b57a4a',
    belly: '#fbeed9',
    ear: '#e3a48d',
  },
  silver: {
    id: 'silver',
    name: '은빛 애',
    light: '#f3f3f1',
    base: '#d4d6d5',
    shade: '#b1b4b3',
    belly: '#fbfbfa',
    ear: '#ddb9b3',
  },
  dove: {
    id: 'dove',
    name: '잿빛 애',
    light: '#cdc6c0',
    base: '#a79f98',
    shade: '#847c75',
    belly: '#e8e2db',
    ear: '#bfa099',
  },
  honey: {
    id: 'honey',
    name: '꿀색 애',
    light: '#ffdd9e',
    base: '#f0bb62',
    shade: '#d09a42',
    belly: '#fff2d4',
    ear: '#e5a382',
  },
  apricot: {
    id: 'apricot',
    name: '살구색 애',
    light: '#ffd9bc',
    base: '#f5b287',
    shade: '#d68f64',
    belly: '#fff0e4',
    ear: '#eda893',
  },
  lilac: {
    id: 'lilac',
    name: '연보라 애',
    light: '#ded6e0',
    base: '#bdb2c4',
    shade: '#9a8ea3',
    belly: '#f0ecf3',
    ear: '#c9a5b4',
  },
  smoke: {
    id: 'smoke',
    name: '연기 같은 애',
    light: '#c6c9cd',
    base: '#9aa0a7',
    shade: '#767c83',
    belly: '#e3e6e9',
    ear: '#b09aa0',
  },
  champagne: {
    id: 'champagne',
    name: '샴페인색 애',
    light: '#f9ead6',
    base: '#e8d3b4',
    shade: '#cbb290',
    belly: '#fdf6ec',
    ear: '#e0b3a4',
  },
  roan: {
    id: 'roan',
    name: '눈 뿌린 애',
    light: '#f4efe8',
    base: '#dcd2c6',
    shade: '#b3a597',
    belly: '#fbf8f4',
    ear: '#d8aca2',
  },
  banded: {
    id: 'banded',
    name: '띠 두른 애',
    light: '#f6e6cb',
    base: '#c08a58',
    shade: '#8f6238',
    belly: '#fdf5e8',
    ear: '#d79a86',
  },
  agouti: {
    id: 'agouti',
    name: '들쥐색 애',
    light: '#d6c3a0',
    base: '#a98e69',
    shade: '#806a4c',
    belly: '#eee2cc',
    ear: '#bf9484',
  },
};

/**
 * 손님으로 올 수 있는 애들 (골든은 내 햄스터 전용).
 *
 * 순서에 뜻이 있다 — 흔한 색을 앞에, 눈에 띄는 색을 뒤에 뒀다.
 * 까만 애나 연보라 애를 처음 봤을 때 "어" 하는 것, 그게 이 목록의 값이다.
 */
export const GUEST_BREEDS: BreedId[] = [
  'white',
  'grey',
  'cream',
  'honey',
  'champagne',
  'cinnamon',
  'dove',
  'calico',
  'apricot',
  'agouti',
  'silver',
  'sable',
  'banded',
  'panda',
  'chocolate',
  'roan',
  'smoke',
  'lilac',
  'black',
];

/** 도감·쟁반 순서 — 정의 순서 그대로 */
export const BREED_IDS = Object.keys(COATS) as BreedId[];
