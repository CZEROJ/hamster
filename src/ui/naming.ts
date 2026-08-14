/**
 * 이름 짓기.
 *
 * ★ 첫 실행에 텍스트 상자를 띄우지 않는다.
 *   낯선 존재에게 이름을 붙이는 것과, 이미 만나본 존재에게 이름을 붙이는 건
 *   완전히 다른 감정이다. 그래서 '처음으로 손길을 받아준 다음'에만 묻는다.
 *   그때 지은 이름은 안 잊힌다.
 *
 * 그리고 강제하지 않는다. 나중에 지을 수 있고, 안 지어도 게임은 굴러간다.
 */
const CSS = `
.nm-back{position:fixed;inset:0;background:rgba(40,28,20,.5);backdrop-filter:blur(2px);
  display:flex;align-items:center;justify-content:center;z-index:60;cursor:default;
  opacity:0;transition:opacity .3s ease;font-family:'Nanum Myeongjo','Batang',serif}
.nm-back.on{opacity:1}
.nm-card{width:min(400px,84vw);background:linear-gradient(#fbf4e6,#f4e9d5);color:#4a3a2c;
  border-radius:4px;padding:34px 36px 26px;text-align:center;
  box-shadow:0 18px 50px rgba(30,18,10,.45), inset 0 0 60px rgba(200,170,120,.18);
  transform:translateY(8px);transition:transform .3s ease}
.nm-back.on .nm-card{transform:none}
.nm-line{font-size:15px;line-height:2;margin-bottom:22px;word-break:keep-all}
.nm-input{width:70%;background:none;border:0;border-bottom:1px solid #c9ac8c;
  font-family:inherit;font-size:19px;color:#4a3a2c;text-align:center;padding:6px 0;outline:none}
.nm-input:focus{border-bottom-color:#8a6b4f}
.nm-row{margin-top:24px;display:flex;justify-content:center;gap:18px}
.nm-row button{background:none;border:0;font-family:inherit;font-size:13px;cursor:pointer;
  color:#a5836a;padding:6px 12px;transition:color .15s}
.nm-row button:hover{color:#6d5137}
.nm-row button.go{color:#7a5c3f}
.nm-row button:disabled{opacity:.3;cursor:default}
`;

export class NamingUI {
  private root: HTMLDivElement;
  private input: HTMLInputElement;
  open = false;

  constructor(private readonly onDone: (name: string | null) => void) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    this.root = document.createElement('div');
    this.root.className = 'nm-back';
    this.root.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'nm-card';

    const line = document.createElement('div');
    line.className = 'nm-line';
    line.textContent = '이 아이를 뭐라고 부를까?';

    this.input = document.createElement('input');
    this.input.className = 'nm-input';
    this.input.maxLength = 12;
    this.input.placeholder = ' ';

    const row = document.createElement('div');
    row.className = 'nm-row';
    const later = document.createElement('button');
    later.textContent = '나중에';
    const go = document.createElement('button');
    go.className = 'go';
    go.textContent = '이렇게 부를래';
    go.disabled = true;

    this.input.addEventListener('input', () => {
      go.disabled = this.input.value.trim().length === 0;
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.input.value.trim()) this.finish(this.input.value.trim());
      e.stopPropagation();
    });
    later.addEventListener('click', () => this.finish(null));
    go.addEventListener('click', () => this.finish(this.input.value.trim()));

    row.append(later, go);
    card.append(line, this.input, row);
    this.root.appendChild(card);
    document.body.appendChild(this.root);
  }

  show(): void {
    this.open = true;
    this.input.value = '';
    this.root.style.display = 'flex';
    requestAnimationFrame(() => {
      this.root.classList.add('on');
      this.input.focus();
    });
  }

  private finish(name: string | null): void {
    this.open = false;
    this.root.classList.remove('on');
    setTimeout(() => {
      if (!this.open) this.root.style.display = 'none';
    }, 300);
    this.onDone(name);
  }
}
