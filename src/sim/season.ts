/**
 * 계절과 날씨.
 *
 * 둘 다 실제 날짜에서 결정론적으로 나온다. 저장할 필요가 없고, 기기가 달라도 같고,
 * 무엇보다 '오늘 비가 왔다'가 그녀의 창밖과 무관하게 게임 안의 사실로 존재한다.
 *
 * 감정적 목적: 부재를 벌하지 않으면서 '돌아올 이유'를 만드는 유일한 장치다.
 * 한 달 만에 켜도 방의 색이 바뀌어 있으면, 그건 빚이 아니라 선물이다.
 */
import { dayKeyOf } from '../journal/facts';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Weather = 'clear' | 'cloudy' | 'rain' | 'snow' | 'wind';

export const SEASON_KR: Record<Season, string> = {
  spring: '봄',
  summer: '여름',
  autumn: '가을',
  winter: '겨울',
};

export const WEATHER_KR: Record<Weather, string> = {
  clear: '맑음',
  cloudy: '흐림',
  rain: '비',
  snow: '눈',
  wind: '바람',
};

export function seasonOf(now: number): Season {
  const m = new Date(now).getMonth() + 1;
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

/** 계절별 날씨 분포. 합이 1이 되도록 둔다. */
const DISTRIBUTION: Record<Season, [Weather, number][]> = {
  spring: [
    ['clear', 0.42],
    ['cloudy', 0.24],
    ['rain', 0.2],
    ['wind', 0.14],
  ],
  summer: [
    ['clear', 0.46],
    ['cloudy', 0.2],
    ['rain', 0.3],
    ['wind', 0.04],
  ],
  autumn: [
    ['clear', 0.44],
    ['cloudy', 0.24],
    ['rain', 0.14],
    ['wind', 0.18],
  ],
  winter: [
    ['clear', 0.36],
    ['cloudy', 0.28],
    ['snow', 0.26],
    ['wind', 0.1],
  ],
};

/** 하루 단위로 고정. 같은 날은 몇 번을 켜도 같은 날씨다. */
export function weatherOf(now: number, seed: number): Weather {
  const season = seasonOf(now);
  const r = hash01(dayKeyOf(now), seed);
  let acc = 0;
  for (const [w, p] of DISTRIBUTION[season]) {
    acc += p;
    if (r < acc) return w;
  }
  return 'clear';
}

export interface Palette {
  /** 케이지 내부에 얹는 색 보정 */
  tint: string;
  tintAlpha: number;
  /** 유리에 드는 빛의 색 */
  light: string;
  lightAlpha: number;
}

const SEASON_LOOK: Record<Season, Palette> = {
  spring: { tint: '#ffd9e8', tintAlpha: 0.1, light: '#fff2c8', lightAlpha: 0.5 },
  summer: { tint: '#fff0b8', tintAlpha: 0.12, light: '#fffbd0', lightAlpha: 0.62 },
  autumn: { tint: '#ffb877', tintAlpha: 0.14, light: '#ffdf9e', lightAlpha: 0.5 },
  winter: { tint: '#b8d4f0', tintAlpha: 0.16, light: '#e8f2ff', lightAlpha: 0.4 },
};

const WEATHER_MOD: Record<Weather, Partial<Palette>> = {
  clear: {},
  cloudy: { tint: '#9aa4b0', tintAlpha: 0.18, lightAlpha: 0.14 },
  rain: { tint: '#7d90a8', tintAlpha: 0.24, light: '#cfe0f0', lightAlpha: 0.12 },
  snow: { tint: '#c8dcf4', tintAlpha: 0.2, lightAlpha: 0.24 },
  wind: { tint: '#d8cbb0', tintAlpha: 0.1 },
};

export function lookOf(season: Season, weather: Weather): Palette {
  return { ...SEASON_LOOK[season], ...WEATHER_MOD[weather] };
}

/**
 * 날씨가 햄스터에게 주는 영향. 아주 약하게만 준다.
 * 날씨 때문에 햄스터가 불행해지면 안 된다 — 그건 그녀가 어쩔 수 없는 일이니까.
 */
export function weatherMood(w: Weather): { comfort: number; energy: number } {
  switch (w) {
    case 'rain':
      return { comfort: 0.02, energy: -0.15 }; // 비 오는 날은 아늑하고 나른하다
    case 'snow':
      return { comfort: 0.015, energy: -0.1 };
    case 'clear':
      return { comfort: 0.005, energy: 0.12 };
    case 'wind':
      return { comfort: -0.005, energy: 0.05 };
    default:
      return { comfort: 0, energy: 0 };
  }
}

function hash01(s: string, seed: number): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (let idx = 0; idx < s.length; idx++) {
    h ^= s.charCodeAt(idx);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}
