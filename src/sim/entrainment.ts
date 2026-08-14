import { clamp } from '../core/math';
import { DEFAULT_WAKE_CURVE } from './schedule';

/**
 * ★ 동조(entrainment) — 햄스터가 그녀의 시간을 배운다.
 *
 * 실제 햄스터는 루틴에 동조한다. 밥 주는 시간을 학습해서 그 시간 '전에' 나와 기다린다.
 * 이 게임에서 그걸 그대로 한다. 접속 시각을 누적해서 각성 곡선을 밀어올린다.
 *
 * 이 시스템이 이 프로젝트의 논지를 문자 그대로 실행한다:
 * "내가 이 생명체에게 흔적을 남겼다"의 가장 강한 증거는
 *  그 생명체가 나를 위해 자기 생체시계를 바꿨다는 사실이다.
 *
 * 설계 규칙 두 개:
 *  1. 학습은 곡선을 '올리기만' 한다. 절대 내리지 않는다.
 *     → 햄스터는 점점 더 자주 깨어 있게 될 뿐, 덜 만나게 되는 일은 없다.
 *  2. 기본 야행성 곡선을 완전히 버리지 않는다. 아무 때나 깨어 있으면 생물이 아니다.
 */

/** 학습 반감기(일). 짧으면 기계로, 길면 아무도 못 보고 지나간다. 2~3주가 목표. */
const HALF_LIFE_DAYS = 21;

/** 이만큼 쌓이면 학습이 거의 다 된 것으로 본다. */
const SATURATION = 16;

/** 최대 학습 강도. 1.0으로 두면 낮에도 멀쩡히 깨어 있어서 야행성이 사라진다. */
const MAX_STRENGTH = 0.9;

/** 그녀가 오기 얼마 전부터 깨어 있을 것인가 (시간 단위) */
const ANTICIPATION_H = 0.75;

export interface Entrainment {
  /** 24칸 각성 곡선 (기본 곡선 + 학습분) */
  curve: number[];
  /** 0..1 — 얼마나 학습됐는가. 일기가 이 값을 보고 문장을 고른다. */
  strength: number;
  /** 학습된 '그녀의 시간' */
  usualHours: number[];
}

export function computeEntrainment(sessionStarts: readonly number[], now: number): Entrainment {
  const hist = new Array<number>(24).fill(0);
  let totalWeight = 0;

  for (const t of sessionStarts) {
    if (t > now) continue; // 시계 조작 방어
    const ageDays = (now - t) / 86_400_000;
    const w = Math.pow(2, -ageDays / HALF_LIFE_DAYS);
    if (w < 0.02) continue;

    const d = new Date(t);
    // 기대(anticipation): 그녀가 온 시각보다 조금 이르게 학습한다 → 미리 나와 기다리게 된다
    const h = d.getHours() + d.getMinutes() / 60 - ANTICIPATION_H;
    const base = Math.floor(h);

    // 도착 시각은 ±30분쯤 흔들린다. 한 칸에만 몰아넣으면 곡선이 뾰족해져서 부자연스럽다.
    add(hist, base - 1, w * 0.22);
    add(hist, base, w * 0.56);
    add(hist, base + 1, w * 0.22);
    totalWeight += w;
  }

  const peak = Math.max(...hist);
  const learned = peak > 0 ? hist.map((v) => v / peak) : hist;
  const strength = Math.min(1, totalWeight / SATURATION) * MAX_STRENGTH;

  const curve = DEFAULT_WAKE_CURVE.map((base, idx) =>
    clamp(base + strength * learned[idx]! * (1 - base), 0, 1),
  );

  const usualHours: number[] = [];
  for (let idx = 0; idx < 24; idx++) if (learned[idx]! > 0.55) usualHours.push(idx);

  return { curve, strength, usualHours };
}

/** 지금이 '그녀가 보통 오는 시간'인가 — 일기의 "일찍 깼다" 문장 조건 */
export function isUsualHour(e: Entrainment, now: number): boolean {
  const h = new Date(now).getHours();
  return e.usualHours.includes(h) || e.usualHours.includes((h + 23) % 24);
}

function add(hist: number[], idx: number, v: number): void {
  hist[((idx % 24) + 24) % 24] += v;
}
