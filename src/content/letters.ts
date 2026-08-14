/**
 * ★ 형이 직접 쓰는 일기.
 *
 * 이건 상용 게임이 절대 못 하는 것이다. 플레이어가 한 명이니까 가능하다.
 * 조건이 맞으면 여기 적은 문장이 '햄스터의 일기'로 끼어든다.
 * 그녀는 이게 생성된 문장인지 형이 쓴 문장인지 구분할 수 없다.
 *
 * 문체를 맞출 필요는 없다. 오히려 어느 날 갑자기 문장이 조금 어른스러워지는 게
 * 더 세게 온다. 다만 화자는 끝까지 햄스터여야 한다.
 *
 * 사용법: 아래 배열에 항목을 추가하기만 하면 된다. 조건은 자유롭게 짜면 된다.
 */

export interface LetterCtx {
  /** 게임 시작일로부터 며칠째 (첫날 = 1) */
  dayNumber: number;
  /** 'YYYY-MM-DD' */
  dayKey: string;
  /** 월 (1-12) */
  month: number;
  /** 일 */
  date: number;
  /** 지금까지 쓰다듬기가 성공한 총 횟수 */
  petTotal: number;
  /** 총 방문 세션 수 */
  sessionTotal: number;
}

export interface Letter {
  /** 한 번 발동하면 다시 안 나온다. id는 절대 바꾸지 말 것 */
  id: string;
  when(c: LetterCtx): boolean;
  text: string;
}

export const LETTERS: Letter[] = [
  // ── 예시 1: 일주일째 ──────────────────────────
  {
    id: 'week-1',
    when: (c) => c.dayNumber >= 7,
    text: '일주일이 지났다고 한다.\n나는 날짜를 셀 줄 모른다.\n그냥 여기가 이제 내 집 같다.',
  },

  // ── 예시 2: 백 번 쓰다듬어진 날 ─────────────────
  {
    id: 'pet-100',
    when: (c) => c.petTotal >= 100,
    text: '손이 오는 게 이제 무섭지 않다.\n오히려 안 오면 이상하다.',
  },

  // ── 여기에 형이 쓰고 싶은 걸 추가하면 된다 ────────
  // {
  //   id: 'birthday-2026',
  //   when: (c) => c.month === 12 && c.date === 25,
  //   text: '오늘은 뭔가 다른 날인 것 같다.\n...',
  // },
];
