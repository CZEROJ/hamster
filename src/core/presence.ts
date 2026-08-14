/**
 * "그녀가 지금 여기 있는가."
 *
 * 동조(entrainment) 시스템이 나중에 이 데이터를 학습한다. 그래서 정확도가 중요하다.
 * 창을 켜두고 잠든 밤은 '함께한 8시간'이 아니라 '자리를 비운 시간'이어야 한다.
 */
const IDLE_TIMEOUT_MS = 3 * 60 * 1000; // 3분간 아무 입력 없으면 자리를 비운 것
const HIDDEN_GRACE_MS = 45 * 1000; // 탭을 잠깐 옮긴 것과 나간 것을 구분

export class Presence {
  private lastActivity: number;
  private hiddenSince: number | null = null;
  private _active = false;

  constructor(
    now: number,
    private readonly onStart: (t: number) => void,
    private readonly onEnd: (t: number, durationMs: number) => void,
  ) {
    this.lastActivity = now;

    const activity = () => this.note(performance.timeOrigin + performance.now());
    for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) {
      window.addEventListener(ev, activity, { passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      const t = performance.timeOrigin + performance.now();
      if (document.hidden) this.hiddenSince = t;
      else {
        this.hiddenSince = null;
        this.note(t);
      }
    });
  }

  private startedAt = 0;

  get active(): boolean {
    return this._active;
  }

  note(now: number): void {
    this.lastActivity = now;
  }

  update(now: number): void {
    const hiddenTooLong = this.hiddenSince !== null && now - this.hiddenSince > HIDDEN_GRACE_MS;
    const idle = now - this.lastActivity > IDLE_TIMEOUT_MS;
    const shouldBeActive = !hiddenTooLong && !idle;

    if (shouldBeActive && !this._active) {
      this._active = true;
      this.startedAt = now;
      this.onStart(now);
    } else if (!shouldBeActive && this._active) {
      this._active = false;
      // 세션 길이는 유휴 타임아웃을 빼고 계산한다. 창 켜두고 잔 시간은 포함하지 않는다.
      this.onEnd(this.lastActivity, Math.max(0, this.lastActivity - this.startedAt));
    }
  }
}
