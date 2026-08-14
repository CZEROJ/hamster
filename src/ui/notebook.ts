import type { Journal, JournalEntry } from '../journal/journal';

/**
 * 일기 열람 화면.
 *
 * ★ 여기만 픽셀 캔버스가 아니라 DOM이다. 의도적인 예외다.
 *   224×126 버퍼에서 한글은 8px도 안 나온다 — 읽을 수가 없다.
 *   이 게임의 감정 전달부 전체가 이 텍스트에 실려 있는데, 픽셀 순수성을 지키자고
 *   못 읽게 만드는 건 본말전도다. 대신 '공책을 집어 든다'는 의식은 그대로 남는다.
 */
const CSS = `
.jn-back{position:fixed;inset:0;background:rgba(40,28,20,.55);backdrop-filter:blur(2px);
  display:flex;align-items:center;justify-content:center;z-index:50;cursor:default;
  opacity:0;transition:opacity .22s ease;font-family:'Nanum Myeongjo','Batang',serif;}
.jn-back.on{opacity:1}
.jn-paper{position:relative;width:min(560px,86vw);max-height:78vh;
  background:linear-gradient(#fbf4e6,#f4e9d5);color:#4a3a2c;
  border-radius:4px;padding:44px 46px 52px;overflow-y:auto;
  box-shadow:0 18px 50px rgba(30,18,10,.45), inset 0 0 60px rgba(200,170,120,.18);
  transform:translateY(8px) scale(.985);transition:transform .22s ease;}
.jn-back.on .jn-paper{transform:none}
.jn-date{font-size:13px;letter-spacing:.08em;color:#a5836a;margin-bottom:20px}
.jn-text{font-size:17px;line-height:2.05;white-space:pre-wrap;word-break:keep-all}
.jn-empty{font-size:15px;line-height:2;color:#9c8873;text-align:center;padding:24px 0}
.jn-nav{position:absolute;bottom:14px;left:0;right:0;display:flex;
  justify-content:space-between;padding:0 22px;}
.jn-nav button{background:none;border:0;color:#9c7d60;font-size:26px;cursor:pointer;
  padding:2px 16px;font-family:inherit;line-height:1;transition:color .15s}
.jn-nav button:hover:not(:disabled){color:#6d5137}
.jn-nav button:disabled{opacity:.18;cursor:default}
.jn-close{position:absolute;top:10px;right:14px;background:none;border:0;
  color:#c4ab90;font-size:18px;cursor:pointer;padding:4px 8px;font-family:inherit}
.jn-close:hover{color:#8a6b4f}
`;

export class NotebookUI {
  private root: HTMLDivElement;
  private paper: HTMLDivElement;
  private index = 0;
  private entries: JournalEntry[] = [];
  open = false;

  constructor(
    private readonly journal: Journal,
    private readonly onClose: () => void,
  ) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'jn-back';
    this.root.style.display = 'none';
    this.paper = document.createElement('div');
    this.paper.className = 'jn-paper';
    this.root.appendChild(this.paper);
    document.body.appendChild(this.root);

    // 바깥을 누르면 덮인다
    this.root.addEventListener('pointerdown', (e) => {
      if (e.target === this.root) this.hide();
    });
    window.addEventListener('keydown', (e) => {
      if (!this.open) return;
      if (e.key === 'Escape') this.hide();
      if (e.key === 'ArrowLeft') this.go(-1);
      if (e.key === 'ArrowRight') this.go(1);
    });
  }

  show(): void {
    this.entries = this.journal.entries();
    this.index = Math.max(0, this.entries.length - 1); // 가장 최근 장부터
    this.open = true;
    this.root.style.display = 'flex';
    requestAnimationFrame(() => this.root.classList.add('on'));
    this.render();
    this.journal.markRead();
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.root.classList.remove('on');
    setTimeout(() => {
      if (!this.open) this.root.style.display = 'none';
    }, 220);
    this.onClose();
  }

  private go(d: number): void {
    const next = this.index + d;
    if (next < 0 || next >= this.entries.length) return;
    this.index = next;
    this.render();
  }

  private render(): void {
    this.paper.replaceChildren();

    const close = el('button', 'jn-close', '✕');
    close.addEventListener('click', () => this.hide());
    this.paper.appendChild(close);

    const entry = this.entries[this.index];
    if (!entry) {
      this.paper.appendChild(el('div', 'jn-empty', '아직 아무것도 쓰여 있지 않다.'));
      return;
    }

    this.paper.appendChild(el('div', 'jn-date', formatDay(entry.day)));
    this.paper.appendChild(el('div', 'jn-text', entry.text));

    const nav = el('div', 'jn-nav', '');
    const prev = el('button', '', '‹');
    const next = el('button', '', '›');
    (prev as HTMLButtonElement).disabled = this.index === 0;
    (next as HTMLButtonElement).disabled = this.index >= this.entries.length - 1;
    prev.addEventListener('click', () => this.go(-1));
    next.addEventListener('click', () => this.go(1));
    nav.append(prev, next);
    this.paper.appendChild(nav);
  }
}

function el(tag: string, cls: string, text: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

/** 진도율도 페이지 번호도 없다. 날짜만 있으면 된다. */
function formatDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${y}년 ${m}월 ${d}일`;
}
