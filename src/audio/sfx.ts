import type { SoundId } from '../sim/types';

/**
 * 절차적 효과음. 오디오 파일이 하나도 없다.
 *
 * 원칙: 코지 게임의 사운드는 '많이'가 아니라 '가끔'이다.
 * 기본값은 정적이고, 소리는 어쩌다 한 번 난다. 매 초 뭔가 울리면 그건 소음이다.
 *
 * 모든 소리는 필터를 통과한 노이즈 버스트다. 실제 햄스터 소리의 대부분이
 * 부스럭거림·긁힘·킁킁거림이라서, 이게 샘플보다 오히려 잘 맞는다.
 */
const MUTE_KEY = 'hamster.mute.v1';

export class Sfx {
  private ac: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private ambientGain: GainNode | null = null;
  muted: boolean;

  constructor() {
    this.muted = localStorage.getItem(MUTE_KEY) === '1';
  }

  /** 브라우저 정책상 사용자 제스처 이후에만 소리가 난다. */
  unlock(): void {
    if (!this.ac) {
      try {
        this.ac = new AudioContext();
      } catch {
        return;
      }
      this.master = this.ac.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ac.destination);
      this.noiseBuf = makeNoise(this.ac, 2);
      this.startAmbient();
    }
    if (this.ac.state === 'suspended') void this.ac.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    if (this.master && this.ac) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ac.currentTime, 0.05);
    }
    return this.muted;
  }

  /** 방의 공기. 있는 줄 모르지만, 끄면 방이 죽는다. */
  private startAmbient(): void {
    const ac = this.ac;
    if (!ac || !this.noiseBuf || !this.master) return;
    const src = ac.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const g = ac.createGain();
    g.gain.value = 0.05;
    src.connect(lp).connect(g).connect(this.master);
    src.start();
    this.ambientGain = g;
  }

  play(id: SoundId, gain = 1): void {
    if (!this.ac || !this.master || this.muted) return;

    switch (id) {
      // 베딩 위의 발 — 아주 짧은 딸깍
      case 'step':
        this.burst(0.05, 'highpass', 2400, 0.9, 0.15 * gain);
        break;

      // 급정지 / 파고들기 — 부스럭
      case 'rustle':
        this.burst(0.19, 'bandpass', 1600, 0.7, 0.14 * gain, 0.012);
        break;

      // 킁킁 — 두 번 끊어서
      case 'sniff':
        this.burst(0.028, 'highpass', 3600, 1.2, 0.085 * gain);
        this.later(0.065, () => this.burst(0.026, 'highpass', 4000, 1.2, 0.07 * gain));
        break;

      // 세수 — 작고 촉촉한 톡
      case 'groom':
        this.burst(0.045, 'bandpass', 2900, 1.8, 0.06 * gain);
        break;

      // 기지개 — 느린 숨
      case 'wake':
        this.burst(0.5, 'lowpass', 900, 0.6, 0.09 * gain, 0.18);
        this.later(0.12, () => this.tone(330, 420, 0.22, 0.035 * gain));
        break;

      // 자리를 잡고 눕는 소리
      case 'settle':
        this.burst(0.42, 'lowpass', 620, 0.6, 0.1 * gain, 0.1);
        break;

      // 아주 가끔 나는 작은 소리. 흔하면 가치가 없다.
      case 'squeak':
        this.tone(880, 1180, 0.09, 0.05 * gain);
        break;

      // 놀라서 튐
      case 'flinch':
        this.burst(0.07, 'highpass', 3000, 1, 0.2 * gain);
        this.later(0.05, () => this.burst(0.16, 'bandpass', 2200, 0.7, 0.12 * gain));
        break;
    }
  }

  private burst(
    dur: number,
    type: BiquadFilterType,
    freq: number,
    q: number,
    gain: number,
    attack = 0.003,
  ): void {
    const ac = this.ac;
    if (!ac || !this.noiseBuf || !this.master) return;

    const src = ac.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;

    const flt = ac.createBiquadFilter();
    flt.type = type;
    flt.frequency.value = freq * (0.9 + Math.random() * 0.2);
    flt.Q.value = q;

    const g = ac.createGain();
    const t = ac.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(flt).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  private tone(from: number, to: number, dur: number, gain: number): void {
    const ac = this.ac;
    if (!ac || !this.master) return;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    const t = ac.currentTime;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);

    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private later(delay: number, fn: () => void): void {
    setTimeout(fn, delay * 1000);
  }

  /** 잠든 동안엔 방이 더 조용해진다 */
  setCalm(calm: boolean): void {
    if (!this.ambientGain || !this.ac) return;
    this.ambientGain.gain.setTargetAtTime(calm ? 0.03 : 0.05, this.ac.currentTime, 1.5);
  }
}

function makeNoise(ac: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  // 갈색 노이즈에 가깝게 — 백색 노이즈는 '쉬익' 하는 디지털 소리가 난다
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buf;
}
