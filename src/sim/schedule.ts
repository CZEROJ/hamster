import { lerp } from '../core/math';

/**
 * 하루 24시간의 각성도 곡선 (0 = 깊은 잠, 1 = 가장 활발).
 *
 * 초기값은 야행성 기준: 21시~새벽 1시 피크, 오전 6~7시에 작은 박명 활동.
 * ★ 이 배열은 System 2에서 '동조(entrainment)'가 학습으로 수정하게 된다.
 *   그래서 상수가 아니라 데이터로 빼뒀다. 지금 바꾸려면 여기 한 줄이면 된다.
 */
export const DEFAULT_WAKE_CURVE: readonly number[] = [
  //  0     1     2     3     4     5     6     7
  0.78, 0.55, 0.3, 0.12, 0.06, 0.1, 0.3, 0.34,
  //  8     9    10    11    12    13    14    15
  0.2, 0.1, 0.07, 0.07, 0.09, 0.11, 0.14, 0.18,
  // 16    17    18    19    20    21    22    23
  0.27, 0.38, 0.5, 0.66, 0.86, 0.96, 1.0, 0.94,
];

/** 실제 시계 기준 각성도. 시간 사이는 부드럽게 보간한다. */
export function wakefulness(now: number, curve: readonly number[] = DEFAULT_WAKE_CURVE): number {
  const d = new Date(now);
  const h = d.getHours() + d.getMinutes() / 60;
  const i = Math.floor(h) % 24;
  const j = (i + 1) % 24;
  return lerp(curve[i]!, curve[j]!, h - Math.floor(h));
}
