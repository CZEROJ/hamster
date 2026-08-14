import type { EventLog } from '../core/log';
import type { Habitat } from '../sim/habitat';

/**
 * 개발용 데모 기록.
 *
 * `?demo` 로 접속하면 3주치 가짜 기록을 심어서, 며칠 기다리지 않고
 * 일기·취향·해금·호칭 변화를 한 번에 볼 수 있다.
 *
 * ★ 저장소가 완전히 분리되어 있다(hamster.save.v1.demo).
 *   진짜 세이브는 절대 건드리지 않는다.
 */
export function seedDemo(log: EventLog, room: Habitat, now: number): void {
  if (log.count('session.start') > 0) return; // 이미 심어져 있다

  const at = (daysAgo: number, hour: number, min = 0): number => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, min, 0, 0);
    return d.getTime();
  };

  for (let d = 22; d >= 1; d--) {
    if (d === 18 || d === 17 || d === 9) continue; // 안 온 날 — 일기가 안 생겨야 한다

    log.append(at(d, 22, 0), 'session.start');
    log.append(at(d, 22, 3), 'pet.accepted');
    if (d % 3 === 0) log.append(at(d, 22, 6), 'hamster.approached');

    // 딸기를 자주 줬다 → 최애가 '형성'되어야 한다. 미리 정해둔 값이 아니다.
    const food = d % 4 === 0 ? 'sunflower' : 'strawberry';
    log.append(at(d, 22, 9), 'food.given', { food });
    log.append(at(d, 22, 11), 'food.eaten', { food, season: 'summer', weather: 'clear' });

    if (d === 21) log.append(at(d, 22, 14), 'hamster.named', { name: '모찌' });
    if (d === 14) log.append(at(d, 22, 15), 'hamster.rare', { what: 'zoomie' });
    if (d === 12) log.append(at(d, 22, 15), 'hamster.wants', { id: 'tunnel' });
    if (d <= 12) log.append(at(d, 22, 16), 'hamster.wokeEarly');

    log.append(at(d, 22, 30), 'hamster.slept');
    log.append(at(d, 22, 31), 'furniture.used', { id: 'house', action: 'sleep' });
    log.append(at(d, 22, 40), 'session.end', { ms: 40 * 60000 });
  }

  // 시작일을 3주 전으로 밀어야 '며칠째'가 맞는다
  (log as unknown as { createdAt: number }).createdAt = at(22, 20);

  // 가구를 넉넉히 깔아둔 방 하나 — 선반과 사다리로 2층까지 만들어둔다
  room.substrate = 'wood';
  room.unlocked = new Set(['house', 'bowl', 'shelf', 'ladder', 'hammock', 'wheel', 'tunnel', 'cloudbed', 'toybox']);
  room.furniture = [
    { id: 'house', cx: 0, cy: 2, x: 12 },
    { id: 'bowl', cx: 1, cy: 2, x: 24 },
    { id: 'wheel', cx: 2, cy: 2, x: 30 },
    { id: 'ladder', cx: 4, cy: 2, x: 10 },
    { id: 'shelf', cx: 4, cy: 2, x: 10 },
  ];
  room.stashCell = null;
  room.saveNow();
  log.flush(now, true);
}
