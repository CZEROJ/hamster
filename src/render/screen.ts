/**
 * 저해상도 버퍼에 그린 뒤 정수배로 확대한다.
 *
 * ★ 캔버스가 브라우저 창 '전체'다. 여백(레터박스)이 0이다.
 *   그래야 사육장 바깥의 공간도 게임 안 공간이 되고, 거기에 집을 더 놓을 수 있다.
 *   창이 크면 그만큼 세상이 넓어질 뿐, 햄스터가 작아지지는 않는다.
 */

/** 리사이즈마다 갱신된다 (ES 모듈 라이브 바인딩) */
export let VIEW_W = 480;
export let VIEW_H = 240;

/**
 * ★ 화면 높이에 게임 픽셀이 몇 개 들어가는가. 이 값이 곧 체감 크기다.
 *   클수록 화면에 많이 담기고 전부 작아 보인다.
 *
 *   예전 값은 250이었고, 그건 브라우저를 100%로 놓고 봤을 때 사육장이
 *   화면 폭의 90%를 먹는 크기였다. 브라우저 확대를 25%로 줄여서 보면
 *   딱 좋았기 때문에 그때의 값(480)을 기본으로 옮겼다 —
 *   확대를 만질 필요 없이 처음부터 그 크기로 나온다.
 */
const PIXELS_PER_SCREEN_H = 480;

/**
 * ★ 초과표본(supersample) 배율.
 *
 * 화면 구성은 그대로 두고 '그리는 밀도'만 올린다. 모든 그림 코드는 예전처럼
 * 뷰 좌표를 쓰지만, 실제 버퍼는 그 두 배 해상도라서 선과 곡선이 두 배로 촘촘해진다.
 * 이 게임은 그림 파일이 하나도 없고 전부 코드로 그리기 때문에, 배율을 올리면
 * 확대돼서 흐려지는 게 아니라 진짜로 더 정밀하게 다시 그려진다.
 *
 * 뷰 좌표를 안 바꾸는 게 핵심이다. 책상 위치, 카메라, 손가락 좌표가 전부 그대로다.
 */
const SS = 2;

/**
 * ★ 손가락으로 만지는 기기인가.
 *
 * 기기 이름(userAgent)으로 맞히려 들면 새 기기가 나올 때마다 틀린다.
 * 'pointer: coarse'는 브라우저가 직접 대답해주는 값이다 — 주된 입력이
 * 뾰족한 것(마우스)이 아니라 뭉툭한 것(손가락)이라는 뜻.
 */
export const COARSE =
  typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/**
 * ★ 손가락은 44px를 요구한다.
 *
 * 애플이 정한 최소 터치 크기다. 쟁반 한 칸이 26 게임픽셀이니, 배율이
 * 44/26 = 1.7 아래로 내려가면 칸이 손가락보다 작아진다.
 *
 * 폰을 눕히면 화면 높이가 390px밖에 안 돼서 예전 규칙(h/480)으로는
 * 배율이 0.9까지 떨어졌다. 쟁반 칸이 23px — 손가락 절반이었다.
 * 잘 안 눌리는 게 아니라 '누를 수 없는' 크기다.
 */
const MIN_TOUCH_SCALE = 44 / 26;

/**
 * ★ 그렇다고 무작정 키우면 방이 안 들어간다.
 *
 * 사육장이 364 게임픽셀이고 책상 물건 자리가 176 더 필요하다.
 * 가로로 이만큼은 확보돼야 방이 방처럼 보인다. 손가락 요구와
 * 부딪히면 이쪽이 이긴다 — 안 보이는 건 못 만지느니만 못하다.
 */
const MIN_VIEW_W = 430;

export class Screen {
  ctx!: CanvasRenderingContext2D;
  private buffer: HTMLCanvasElement;
  private readonly display: HTMLCanvasElement;
  private readonly out: CanvasRenderingContext2D;
  private cssScale = 1;

  constructor(display: HTMLCanvasElement) {
    this.display = display;
    this.buffer = document.createElement('canvas');

    const dctx = display.getContext('2d', { alpha: false });
    if (!dctx) throw new Error('2d context unavailable');
    this.out = dctx;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(240, window.innerHeight);

    /**
     * 소수 배율을 허용한다.
     *
     * 예전엔 정수로 반올림했다 — 저해상도 버퍼를 그대로 확대하니 정수라야 도트가 선명해서다.
     * 지금은 버퍼가 이미 두 배(SS)로 그려지기 때문에 소수 배율에서도 안 뭉개진다.
     * 정수를 고집하면 1.5 같은 값을 못 써서 '25% 크기'를 아예 만들 수가 없다.
     */
    /**
     * 손가락 기기면 '최소 손가락 크기'를 바닥으로 깐다.
     * 단 방이 안 들어갈 만큼은 못 키운다 (w / MIN_VIEW_W 가 천장).
     *
     * 데스크톱은 COARSE가 false라 예전 값 그대로다 —
     * 폰을 고치다가 PC를 망가뜨리면 안 되니 여기서 갈라둔다.
     */
    const fit = h / PIXELS_PER_SCREEN_H;
    const want = COARSE ? Math.max(fit, MIN_TOUCH_SCALE) : fit;
    const roomCap = Math.max(0.9, w / MIN_VIEW_W);
    this.cssScale = Math.min(6, Math.max(0.9, Math.min(want, roomCap)));

    VIEW_W = Math.ceil(w / this.cssScale);
    VIEW_H = Math.ceil(h / this.cssScale);

    this.buffer.width = VIEW_W * SS;
    this.buffer.height = VIEW_H * SS;
    const bctx = this.buffer.getContext('2d', { alpha: false });
    if (!bctx) throw new Error('2d context unavailable');
    this.ctx = bctx;

    const dpr = window.devicePixelRatio || 1;
    const deviceScale = Math.max(1, Math.round(this.cssScale * dpr));
    this.display.width = VIEW_W * deviceScale;
    this.display.height = VIEW_H * deviceScale;
    this.display.style.width = `${VIEW_W * this.cssScale}px`;
    this.display.style.height = `${VIEW_H * this.cssScale}px`;
    // 버퍼가 화면보다 촘촘하면 부드럽게, 성기면 도트가 뭉개지지 않게
    this.out.imageSmoothingEnabled = SS >= deviceScale;
  }

  /** 매 프레임 그리기 전에 부른다. 뷰 좌표계를 다시 세운다. */
  beginFrame(): void {
    this.ctx.setTransform(SS, 0, 0, SS, 0, 0);
  }

  /** 화면 좌표 → 뷰(픽셀) 좌표 */
  toView(clientX: number, clientY: number): { x: number; y: number; inside: boolean } {
    const r = this.display.getBoundingClientRect();
    const x = (clientX - r.left) / this.cssScale;
    const y = (clientY - r.top) / this.cssScale;
    return { x, y, inside: x >= 0 && y >= 0 && x < VIEW_W && y < VIEW_H };
  }

  present(): void {
    this.out.imageSmoothingEnabled = false;
    this.out.drawImage(this.buffer, 0, 0, this.display.width, this.display.height);
  }
}
