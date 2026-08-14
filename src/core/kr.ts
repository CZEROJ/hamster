/**
 * 한국어 조사 처리.
 *
 * 영어 템플릿은 슬롯만 채우면 되지만 한국어는 앞 글자의 받침에 따라 조사가 바뀐다.
 * "해바라기씨를" / "사과를", "창가는" / "햇빛은".
 * 이게 틀리면 문장이 즉시 기계로 읽히고, 일기의 마법이 깨진다.
 */

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;

/** 마지막 글자에 받침이 있는가. 받침 종류(0=없음, 8=ㄹ)도 함께 준다. */
function finalConsonant(word: string): number | null {
  const trimmed = word.trim();
  if (!trimmed) return null;
  const code = trimmed.charCodeAt(trimmed.length - 1);
  if (code < HANGUL_BASE || code > HANGUL_END) return null; // 한글이 아니면 판정 불가
  return (code - HANGUL_BASE) % 28;
}

/** 받침 있으면 첫 번째, 없으면 두 번째. (은/는, 이/가, 을/를, 과/와, 아/야) */
export function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  const f = finalConsonant(word);
  if (f === null) return withoutBatchim; // 판정 불가하면 받침 없는 쪽 (덜 어색하다)
  return f === 0 ? withoutBatchim : withBatchim;
}

export const eun = (w: string): string => w + josa(w, '은', '는');
export const i = (w: string): string => w + josa(w, '이', '가');
export const eul = (w: string): string => w + josa(w, '을', '를');
export const gwa = (w: string): string => w + josa(w, '과', '와');

/** 으로/로 — ㄹ 받침은 예외적으로 '로'를 쓴다 */
export const ro = (w: string): string => {
  const f = finalConsonant(w);
  if (f === null || f === 0 || f === 8) return w + '로';
  return w + '으로';
};

/**
 * 템플릿 안에서 쓰는 축약 표기.
 *   fill('{name}{은} 오늘도 잤다.', { name: '모찌' })  →  '모찌는 오늘도 잤다.'
 *
 * 슬롯 바로 뒤에 오는 {은}{이}{을}{과}{로}는 앞 단어를 보고 자동 선택된다.
 */
const PARTICLES: Record<string, [string, string]> = {
  은: ['은', '는'],
  이: ['이', '가'],
  을: ['을', '를'],
  과: ['과', '와'],
  아: ['아', '야'],
};

export function fill(template: string, vars: Record<string, string>): string {
  let last = '';
  // ⚠️ \w 는 한글을 못 잡는다. 조사 슬롯 자체가 한글이므로 [^}]+ 여야 한다.
  return template.replace(/\{([^}]+)\}/g, (_m, key: string) => {
    if (key === '로') return ro(last).slice(last.length);
    const p = PARTICLES[key];
    if (p) return josa(last, p[0], p[1]);
    const v = vars[key] ?? '';
    last = v;
    return v;
  });
}
