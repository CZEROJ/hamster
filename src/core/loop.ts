/**
 * 고정 타임스텝 시뮬레이션 + 자유 렌더.
 * 시뮬레이션이 프레임레이트에 흔들리면 결정론이 깨지고, 무엇보다 '게임 필'이 기기마다 달라진다.
 */
export interface LoopOptions {
  hz: number;
  update(dt: number, now: number): void;
  render(now: number): void;
}

export function startLoop(opts: LoopOptions): () => void {
  const step = 1 / opts.hz;
  const stepMs = step * 1000;
  let acc = 0;
  let last = performance.now();
  let raf = 0;

  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);

    let delta = t - last;
    last = t;
    // 탭 복귀 시 수천 스텝을 몰아 돌리지 않는다. 장기 부재는 별도로 처리한다.
    if (delta > 250) delta = 250;
    acc += delta;

    const wallNow = performance.timeOrigin + t;
    let steps = 0;
    while (acc >= stepMs && steps < 6) {
      opts.update(step, wallNow);
      acc -= stepMs;
      steps++;
    }
    if (steps === 6) acc = 0;

    opts.render(wallNow);
  };

  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
