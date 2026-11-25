import {
  MUSIC_PLAYLIST,
  type AudioMode,
  type MusicTrack,
} from "../data/musicPlaylist";

export interface BgmSnapshot {
  isPlaying: boolean;
  isLoading: boolean;
  isOpen: boolean;
  trackIndex: number;
  track: MusicTrack;
  sourceMode: AudioMode;
  muted: boolean;
  volume: number;
  inGame: boolean;
  hasOtherModal: boolean;
  hasZoneCard: boolean;
  hasStreetSignal: boolean;
}

type Listener = (snapshot: BgmSnapshot) => void;

export interface BgmActions {
  togglePlay: () => void;
  startIfAllowed: () => void;
  pause: () => void;
  togglePanel: () => void;
  setOpen: (open: boolean) => void;
  nextTrack: () => void;
  randomTrack: () => void;
  setGlobalMute: (muted: boolean) => void;
}

class BgmBridge {
  private state: BgmSnapshot = {
    isPlaying: false,
    isLoading: false,
    isOpen: false,
    trackIndex: 0,
    track: MUSIC_PLAYLIST[0],
    sourceMode: "youtube",
    muted: false,
    volume: 65,
    inGame: false,
    hasOtherModal: false,
    hasZoneCard: false,
    hasStreetSignal: false,
  };

  private listeners = new Set<Listener>();
  private actions: BgmActions | null = null;

  registerActions(actions: BgmActions): void {
    this.actions = actions;
  }

  getSnapshot(): BgmSnapshot {
    return this.state;
  }

  update(patch: Partial<BgmSnapshot>): void {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof BgmSnapshot)[]) {
      if (this.state[key] !== patch[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  togglePlay(): void {
    this.actions?.togglePlay();
  }

  startOnEnterGame(): void {
    this.actions?.startIfAllowed();
  }

  pause(): void {
    this.actions?.pause();
  }

  togglePanel(): void {
    this.actions?.togglePanel();
  }

  setPanelOpen(open: boolean): void {
    this.actions?.setOpen(open);
  }

  nextTrack(): void {
    this.actions?.nextTrack();
  }

  randomTrack(): void {
    this.actions?.randomTrack();
  }

  setGlobalMute(muted: boolean): void {
    this.actions?.setGlobalMute(muted);
  }
}

export const bgmBridge = new BgmBridge();

declare global {
  interface Window {
    __CAMPUS_BGM__?: BgmBridge;
  }
}

if (typeof window !== "undefined") {
  window.__CAMPUS_BGM__ = bgmBridge;
}
