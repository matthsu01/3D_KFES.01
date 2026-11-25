import type { MusicTimbre, MusicTrack } from "../data/musicPlaylist";

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function createHallReverb(ctx: AudioContext, durationSec = 2.2): ConvolverNode {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * durationSec);
  const buffer = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const decay = Math.pow(1 - i / len, 2.6);
      data[i] = (Math.random() * 2 - 1) * decay * 0.4;
    }
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = buffer;
  return convolver;
}

export interface SynthCallbacks {
  onProgress?: (elapsed: number, total: number) => void;
  onLoopEnd?: () => void;
}

/**
 * Real-time stereo Web Audio synthesizer providing warm soothing accompaniment
 * with hall reverb for all 8 background music tracks (manual switch or automatic
 * fallback when YouTube embedding is restricted).
 */
export class SoothingSynthEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private stepTimer: number | null = null;
  private progressTimer: number | null = null;
  private currentTrack: MusicTrack | null = null;
  private stepIdx = 0;
  private isPlaying = false;
  private volume = 0.65;
  private muted = false;
  private elapsedSeconds = 0;
  private loopsInTrack = 0;
  private readonly onProgress?: (elapsed: number, total: number) => void;
  private readonly onLoopEnd?: () => void;

  constructor(callbacks?: SynthCallbacks) {
    this.onProgress = callbacks?.onProgress;
    this.onLoopEnd = callbacks?.onLoopEnd;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume * 0.42;

      const reverb = createHallReverb(this.ctx, 2.2);
      this.dryGain = this.ctx.createGain();
      this.dryGain.gain.value = 0.72;
      this.wetGain = this.ctx.createGain();
      this.wetGain.gain.value = 0.34;

      this.dryGain.connect(this.masterGain);
      this.wetGain.connect(reverb);
      reverb.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getLoopDuration(track: MusicTrack): number {
    const totalBeats = track.pattern.reduce((sum, step) => sum + step.beats, 0);
    return (totalBeats * 60) / track.bpm;
  }

  private playNote(
    freq: number,
    duration: number,
    timbre: MusicTimbre,
    isChord: boolean
  ): void {
    if (!this.ctx || !this.dryGain || !this.wetGain) return;
    const now = this.ctx.currentTime;
    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();
    filter.type = "lowpass";

    if (isChord) {
      oscA.type = "triangle";
      oscB.type = "sine";
      oscA.frequency.setValueAtTime(freq, now);
      oscB.frequency.setValueAtTime(freq * 1.002, now);
      filter.frequency.setValueAtTime(timbre === "brass" ? 1100 : 880, now);

      const peak = 0.085;
      const hold = Math.max(duration, 1.4);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(peak, now + 0.14);
      env.gain.exponentialRampToValueAtTime(peak * 0.6, now + hold * 0.65);
      env.gain.exponentialRampToValueAtTime(0.0001, now + hold + 0.35);

      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(env);
      env.connect(this.dryGain);
      env.connect(this.wetGain);
      oscA.start(now);
      oscB.start(now);
      oscA.stop(now + hold + 0.4);
      oscB.stop(now + hold + 0.4);
      return;
    }

    let peak = 0.22;
    let attack = 0.04;
    let release = 0.28;

    switch (timbre) {
      case "flute":
        oscA.type = "sine";
        oscB.type = "triangle";
        oscA.frequency.setValueAtTime(freq, now);
        oscB.frequency.setValueAtTime(freq * 2, now);
        filter.frequency.setValueAtTime(2200, now);
        attack = 0.065;
        release = 0.3;
        peak = 0.2;
        break;
      case "brass":
        oscA.type = "triangle";
        oscB.type = "sawtooth";
        oscA.frequency.setValueAtTime(freq, now);
        oscB.frequency.setValueAtTime(freq * 1.003, now);
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.linearRampToValueAtTime(1650, now + 0.12);
        filter.frequency.exponentialRampToValueAtTime(950, now + duration);
        attack = 0.055;
        release = 0.22;
        peak = 0.16;
        break;
      case "strings":
        oscA.type = "triangle";
        oscB.type = "sawtooth";
        oscA.frequency.setValueAtTime(freq, now);
        oscB.frequency.setValueAtTime(freq * 0.997, now);
        filter.frequency.setValueAtTime(1450, now);
        attack = 0.05;
        release = 0.26;
        peak = 0.15;
        break;
      case "waltz":
        oscA.type = "triangle";
        oscB.type = "sine";
        oscA.frequency.setValueAtTime(freq, now);
        oscB.frequency.setValueAtTime(freq * 1.004, now);
        filter.frequency.setValueAtTime(1850, now);
        attack = 0.035;
        release = 0.32;
        peak = 0.2;
        break;
      default: // piano
        oscA.type = "triangle";
        oscB.type = "sine";
        oscA.frequency.setValueAtTime(freq, now);
        oscB.frequency.setValueAtTime(freq * 2, now);
        filter.frequency.setValueAtTime(2600, now);
        filter.frequency.exponentialRampToValueAtTime(
          700,
          now + Math.max(duration, 0.5)
        );
        attack = 0.015;
        release = 0.45;
        peak = 0.22;
        break;
    }

    const overtoneGain = this.ctx.createGain();
    overtoneGain.gain.value =
      timbre === "flute" || timbre === "piano" ? 0.14 : 0.32;

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peak, now + attack);
    const sustainEnd = now + Math.max(duration * 0.88, attack + 0.05);
    env.gain.exponentialRampToValueAtTime(Math.max(peak * 0.55, 0.001), sustainEnd);
    env.gain.exponentialRampToValueAtTime(0.0001, sustainEnd + release);

    oscA.connect(filter);
    oscB.connect(overtoneGain);
    overtoneGain.connect(filter);
    filter.connect(env);
    env.connect(this.dryGain);
    env.connect(this.wetGain);

    oscA.start(now);
    oscB.start(now);
    oscA.stop(sustainEnd + release + 0.06);
    oscB.stop(sustainEnd + release + 0.06);
  }

  private scheduleNext(): void {
    if (!this.isPlaying || !this.currentTrack) return;
    const track = this.currentTrack;
    const step = track.pattern[this.stepIdx];
    const beatSec = 60 / track.bpm;
    const duration = step.beats * beatSec;

    if (step.chord && step.chord.length > 0) {
      for (const midi of step.chord) {
        this.playNote(midiToFreq(midi), Math.max(duration * 2, 1.8), track.timbre, true);
      }
    }
    if (typeof step.melody === "number") {
      this.playNote(midiToFreq(step.melody), duration, track.timbre, false);
    }

    this.stepIdx = (this.stepIdx + 1) % track.pattern.length;
    if (this.stepIdx === 0) {
      this.loopsInTrack += 1;
      if (this.loopsInTrack >= 4) {
        this.loopsInTrack = 0;
        this.elapsedSeconds = 0;
        if (this.onLoopEnd) {
          this.stepTimer = window.setTimeout(() => this.onLoopEnd?.(), duration * 1000);
          return;
        }
      }
    }

    this.stepTimer = window.setTimeout(() => this.scheduleNext(), duration * 1000);
  }

  start(track: MusicTrack, reset = true): void {
    this.stopTimers();
    this.ensureContext();
    if (reset || this.currentTrack?.id !== track.id) {
      this.stepIdx = 0;
      this.elapsedSeconds = 0;
      this.loopsInTrack = 0;
    }
    this.currentTrack = track;
    this.isPlaying = true;
    const totalDuration = this.getLoopDuration(track) * 4;
    this.progressTimer = window.setInterval(() => {
      if (this.isPlaying) {
        this.elapsedSeconds = Math.min(this.elapsedSeconds + 0.5, totalDuration);
        this.onProgress?.(this.elapsedSeconds, totalDuration);
      }
    }, 500);
    this.onProgress?.(this.elapsedSeconds, totalDuration);
    this.scheduleNext();
  }

  seekTo(seconds: number): void {
    if (!this.currentTrack) return;
    const total = this.getLoopDuration(this.currentTrack) * 4;
    const clamped = Math.max(0, Math.min(total, seconds));
    this.elapsedSeconds = clamped;
    const singleLoop = this.getLoopDuration(this.currentTrack);
    this.loopsInTrack = Math.min(3, Math.floor(clamped / singleLoop));
    const offsetInLoop = clamped - this.loopsInTrack * singleLoop;
    const beatSec = 60 / this.currentTrack.bpm;
    let acc = 0;
    let foundIdx = 0;
    for (let i = 0; i < this.currentTrack.pattern.length; i++) {
      if (acc >= offsetInLoop) {
        foundIdx = i;
        break;
      }
      acc += this.currentTrack.pattern[i].beats * beatSec;
    }
    this.stepIdx = foundIdx;
    this.onProgress?.(this.elapsedSeconds, total);
  }

  pause(): void {
    this.isPlaying = false;
    this.stopTimers();
  }

  unlock(): void {
    try {
      this.ensureContext();
    } catch {
      // ignore unlock error if browser restricts audio context
    }
  }

  resume(): void {
    if (this.currentTrack && !this.isPlaying) {
      this.start(this.currentTrack, false);
    }
  }

  stop(): void {
    this.isPlaying = false;
    this.stopTimers();
    this.stepIdx = 0;
    this.elapsedSeconds = 0;
    this.loopsInTrack = 0;
  }

  setVolume(volumePercent: number): void {
    this.volume = Math.max(0, Math.min(1, volumePercent / 100));
    if (this.masterGain && this.ctx) {
      const gain = this.muted ? 0 : this.volume * 0.42;
      this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      const gain = muted ? 0 : this.volume * 0.42;
      this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.05);
    }
  }

  destroy(): void {
    this.stop();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  private stopTimers(): void {
    if (this.stepTimer !== null) {
      window.clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }
}
