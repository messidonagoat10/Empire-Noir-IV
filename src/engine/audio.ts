export class NoirAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private rainNoise: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;

  private muted = false;
  private masterVolume = 0.75;
  private sfxVolume = 0.85;
  private stepAccum = 0;

  ensureStarted() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : this.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;
    this.sfxGain.connect(this.masterGain);

    // V8 Muscle Car Engine Loop (quiet until player drives)
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 46;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 180;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;

    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);
    this.engineOsc.start();

    // Soft rain / city ambience loop
    const bufLen = this.ctx.sampleRate * 2;
    const noiseBuf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.35;
    }
    this.rainNoise = this.ctx.createBufferSource();
    this.rainNoise.buffer = noiseBuf;
    this.rainNoise.loop = true;

    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 950;
    rainFilter.Q.value = 0.7;

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.03;

    this.rainNoise.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    this.rainNoise.start();
  }

  setVolumes(master: number, sfx: number, muted: boolean) {
    this.masterVolume = master;
    this.sfxVolume = sfx;
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0 : master,
        this.ctx.currentTime,
        0.04
      );
    }
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.04);
    }
  }

  updateContinuous(
    inVehicle: boolean,
    rpm01: number,
    walkSpeed: number,
    dt: number,
    weather: 'clear' | 'drizzle' | 'storm',
    paused: boolean
  ) {
    if (!this.ctx || !this.engineGain || !this.engineOsc || !this.engineFilter || !this.rainGain) {
      return;
    }
    const now = this.ctx.currentTime;
    if (paused) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.05);
      this.rainGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }

    // Rain ambience
    const rainTarget = weather === 'storm' ? 0.11 : weather === 'drizzle' ? 0.045 : 0.008;
    this.rainGain.gain.setTargetAtTime(rainTarget, now, 0.25);

    // Engine V8 rumble
    if (inVehicle) {
      this.engineOsc.frequency.setTargetAtTime(42 + rpm01 * 92, now, 0.06);
      this.engineFilter.frequency.setTargetAtTime(160 + rpm01 * 520, now, 0.06);
      this.engineGain.gain.setTargetAtTime(0.06 + rpm01 * 0.06, now, 0.06);
    } else {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      if (walkSpeed > 0.6) {
        this.stepAccum += walkSpeed * dt;
        if (this.stepAccum >= 1.55) {
          this.stepAccum = 0;
          this.playFootstep();
        }
      }
    }
  }

  playFootstep() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const pitch = 95 + (Math.random() - 0.5) * 16;
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.065);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playHorn() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    [340, 425].forEach((freq) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  playImpact(strength: number) {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.22);
    const vol = Math.min(0.28, 0.06 + strength * 0.015);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playGunshot(weaponId: 'revolver' | 'pistol' | 'tommy' | 'shotgun') {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const isShotgun = weaponId === 'shotgun';
    const isTommy = weaponId === 'tommy';
    osc.type = isShotgun ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(isShotgun ? 180 : isTommy ? 320 : 260, now);
    osc.frequency.exponentialRampToValueAtTime(isShotgun ? 34 : 52, now + (isShotgun ? 0.24 : 0.11));
    gain.gain.setValueAtTime(isShotgun ? 0.22 : 0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isShotgun ? 0.26 : 0.13));
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + (isShotgun ? 0.28 : 0.15));
  }

  playContractSting() {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;
    [220, 261.63, 329.63, 493.88].forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0.001, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.04 + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + idx * 0.04);
      osc.stop(now + 1.2);
    });
  }

  speakText(text: string, enabled: boolean, pitch = 0.88, rate = 0.94) {
    if (!enabled || this.muted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = rate;
      utter.pitch = pitch;
      utter.volume = this.masterVolume;
      window.speechSynthesis.speak(utter);
    } catch {
      // Speech synthesis optional
    }
  }

  dispose() {
    try {
      this.engineOsc?.stop();
      this.rainNoise?.stop();
      void this.ctx?.close();
    } catch {
      // ignore
    }
  }
}
