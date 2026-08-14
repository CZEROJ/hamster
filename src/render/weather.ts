import { lookOf, type Season, type Weather } from '../sim/season';
import { VIEW_H, VIEW_W } from './screen';

/**
 * 계절 색보정.
 * 날씨 입자는 여기 없다 — 창밖(backdrop.ts)에서만 일어난다.
 * 실내에 비가 내리면 즉시 가짜가 된다.
 */
const SKY: Record<Weather, Record<Season, string>> = {
  clear: { spring: '#bcd8ee', summer: '#a8d2f0', autumn: '#c9d8e8', winter: '#cadaea' },
  cloudy: { spring: '#a8adb4', summer: '#a9aeb2', autumn: '#9fa4aa', winter: '#a4aab2' },
  rain: { spring: '#7c8894', summer: '#77848f', autumn: '#737d88', winter: '#767f8a' },
  snow: { spring: '#c4ccd6', summer: '#c4ccd6', autumn: '#c0c8d2', winter: '#c8d2de' },
  wind: { spring: '#b8cadb', summer: '#b4c8dc', autumn: '#c2c8d0', winter: '#bcc6d2' },
};

export function skyColor(season: Season, weather: Weather): string {
  return SKY[weather][season];
}

/** 방 전체에 얹는 계절 색. 아주 옅게 — 세지면 방이 탁해진다. */
export function drawSeasonTint(
  ctx: CanvasRenderingContext2D,
  season: Season,
  weather: Weather,
): void {
  const look = lookOf(season, weather);
  ctx.globalAlpha = look.tintAlpha * 0.5;
  ctx.fillStyle = look.tint;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.globalAlpha = 1;
}
