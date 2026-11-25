import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Disc3,
  ExternalLink,
  Music,
  Pause,
  Play,
  Radio,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  MUSIC_PLAYLIST,
  SOURCE_PLAYLIST_URL,
  getYouTubeThumbnailUrl,
  getYouTubeWatchUrl,
  type AudioMode,
  type RepeatMode,
} from "../data/musicPlaylist";
import { SoothingSynthEngine } from "../audio/soothingSynth";
import {
  loadYouTubeIframeAPI,
  type YTPlayerInstance,
} from "../audio/youtubeLoader";
import { bgmBridge } from "../audio/bgmBridge";

const STORAGE_TRACK = "gf-bgm-track-idx";
const STORAGE_VOL = "gf-bgm-volume";
const STORAGE_REPEAT = "gf-bgm-repeat";
const STORAGE_MODE = "gf-bgm-source";
const STORAGE_USER_PAUSED = "gf-bgm-paused";

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore storage restriction in private browsing
  }
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export const BackgroundMusicPlayer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [trackIdx, setTrackIdx] = useState<number>(() => {
    const raw = readStorage(STORAGE_TRACK);
    if (raw === null || raw.trim() === "") return 0;
    const saved = Number(raw);
    return Number.isInteger(saved) && saved >= 0 && saved < MUSIC_PLAYLIST.length
      ? saved
      : 0;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>(() => {
    const saved = readStorage(STORAGE_MODE);
    return saved === "synth" ? "synth" : "youtube";
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(() => {
    const raw = readStorage(STORAGE_VOL);
    if (raw === null || raw.trim() === "") return 65;
    const saved = Number(raw);
    return Number.isFinite(saved) && saved >= 0 && saved <= 100
      ? Math.round(saved)
      : 65;
  });
  const [muted, setMuted] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(() => {
    const saved = readStorage(STORAGE_REPEAT);
    return saved === "one" || saved === "shuffle" ? saved : "list";
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [inGame, setInGame] = useState(false);
  const [hasOtherModal, setHasOtherModal] = useState(false);

  const currentTrack = MUSIC_PLAYLIST[trackIdx] ?? MUSIC_PLAYLIST[0];

  const ytHostRef = useRef<HTMLDivElement | null>(null);
  const activeRowRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YTPlayerInstance | null>(null);
  const ytReadyRef = useRef(false);
  const ytCreatingRef = useRef(false);
  const synthRef = useRef<SoothingSynthEngine | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  const trackIdxRef = useRef(trackIdx);
  const repeatRef = useRef(repeatMode);
  const modeRef = useRef(audioMode);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  const wantPlayRef = useRef(false);
  const userPausedRef = useRef(readStorage(STORAGE_USER_PAUSED) === "1");

  trackIdxRef.current = trackIdx;
  repeatRef.current = repeatMode;
  modeRef.current = audioMode;
  volumeRef.current = volume;
  mutedRef.current = muted;

  useEffect(() => {
    setThumbFailed(false);
  }, [currentTrack.videoId]);

  useEffect(() => {
    writeStorage(STORAGE_TRACK, String(trackIdx));
  }, [trackIdx]);

  useEffect(() => {
    writeStorage(STORAGE_VOL, String(volume));
  }, [volume]);

  useEffect(() => {
    writeStorage(STORAGE_REPEAT, repeatMode);
  }, [repeatMode]);

  useEffect(() => {
    writeStorage(STORAGE_MODE, audioMode);
  }, [audioMode]);

  // Subscribe to layout/mode updates coming from Campus Quest
  useEffect(() => {
    return bgmBridge.subscribe((snap) => {
      setInGame(snap.inGame);
      setHasOtherModal(snap.hasOtherModal);
    });
  }, []);

  // Push live audio player status back into Campus Quest bridge
  useEffect(() => {
    bgmBridge.update({
      isPlaying: isPlaying || isLoading,
      isLoading,
      isOpen,
      trackIndex: trackIdx,
      track: currentTrack,
      sourceMode: audioMode,
      muted,
      volume,
    });
  }, [
    isPlaying,
    isLoading,
    isOpen,
    trackIdx,
    currentTrack,
    audioMode,
    muted,
    volume,
  ]);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const pauseYouTube = useCallback(() => {
    clearFallbackTimer();
    try {
      if (ytPlayerRef.current && ytReadyRef.current) {
        ytPlayerRef.current.pauseVideo();
      }
    } catch {
      // ignore iframe errors
    }
  }, [clearFallbackTimer]);

  const pauseSynth = useCallback(() => {
    synthRef.current?.pause();
  }, []);

  const pickNextIndex = useCallback(
    (idx: number, mode: RepeatMode, forceAdvance = false): number => {
      if (mode === "one" && !forceAdvance) return idx;
      if (mode === "shuffle") {
        if (MUSIC_PLAYLIST.length <= 1) return 0;
        let next = idx;
        while (next === idx) {
          next = Math.floor(Math.random() * MUSIC_PLAYLIST.length);
        }
        return next;
      }
      return (idx + 1) % MUSIC_PLAYLIST.length;
    },
    []
  );

  const playTrackRef = useRef<(idx: number, forceMode?: AudioMode) => void>(
    () => {}
  );

  const ensureSynth = useCallback((): SoothingSynthEngine => {
    if (!synthRef.current) {
      synthRef.current = new SoothingSynthEngine({
        onProgress: (elapsed, total) => {
          if (modeRef.current === "synth") {
            setCurrentTime(elapsed);
            setDuration(total);
          }
        },
        onLoopEnd: () => {
          if (modeRef.current === "synth" && wantPlayRef.current) {
            const next = pickNextIndex(trackIdxRef.current, repeatRef.current);
            playTrackRef.current(next, "synth");
          }
        },
      });
    }
    return synthRef.current;
  }, [pickNextIndex]);

  const fallbackToSynth = useCallback(
    (message: string, idx: number) => {
      clearFallbackTimer();
      pauseYouTube();
      setAudioMode("synth");
      modeRef.current = "synth";
      setIsLoading(false);
      setNotice(message);
      const synth = ensureSynth();
      synth.setVolume(volumeRef.current);
      synth.setMuted(mutedRef.current);
      synth.start(MUSIC_PLAYLIST[idx], true);
      setIsPlaying(true);
    },
    [clearFallbackTimer, pauseYouTube, ensureSynth]
  );

  const startYouTube = useCallback(
    async (idx: number) => {
      const track = MUSIC_PLAYLIST[idx];
      pauseSynth();
      setIsLoading(true);
      setCurrentTime(0);
      setDuration(0);
      clearFallbackTimer();

      const armTimeout = () => {
        clearFallbackTimer();
        fallbackTimerRef.current = window.setTimeout(() => {
          if (!wantPlayRef.current || modeRef.current !== "youtube") return;
          let state = -1;
          try {
            state = ytPlayerRef.current?.getPlayerState() ?? -1;
          } catch {
            state = -1;
          }
          if (state !== 1) {
            fallbackToSynth(
              "YouTube 串流受限，已自動切換為內建舒緩伴奏",
              trackIdxRef.current
            );
          }
        }, 7500);
      };

      if (ytPlayerRef.current && ytReadyRef.current) {
        try {
          ytPlayerRef.current.loadVideoById(track.videoId);
          ytPlayerRef.current.setVolume(volumeRef.current);
          if (mutedRef.current) {
            ytPlayerRef.current.mute();
          } else {
            ytPlayerRef.current.unMute();
          }
          ytPlayerRef.current.playVideo();
          armTimeout();
          return;
        } catch {
          fallbackToSynth("YouTube 播放切換異常，已改用內建舒緩伴奏", idx);
          return;
        }
      }

      if (ytCreatingRef.current) return;
      ytCreatingRef.current = true;
      try {
        const YT = await loadYouTubeIframeAPI();
        ytCreatingRef.current = false;
        if (!wantPlayRef.current || modeRef.current !== "youtube") {
          setIsLoading(false);
          return;
        }
        if (!ytHostRef.current) return;
        const mountNode = document.createElement("div");
        ytHostRef.current.innerHTML = "";
        ytHostRef.current.appendChild(mountNode);

        const active = MUSIC_PLAYLIST[trackIdxRef.current];
        const playerVars: Record<string, string | number> = {
          autoplay: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          enablejsapi: 1,
        };
        if (window.location.protocol.startsWith("http")) {
          playerVars.origin = window.location.origin;
        }

        armTimeout();
        ytPlayerRef.current = new YT.Player(mountNode, {
          width: 240,
          height: 135,
          videoId: active.videoId,
          playerVars,
          events: {
            onReady: (ev) => {
              ytReadyRef.current = true;
              try {
                const iframe = ev.target.getIframe();
                if (iframe) {
                  iframe.setAttribute(
                    "referrerpolicy",
                    "strict-origin-when-cross-origin"
                  );
                  iframe.setAttribute("allow", "autoplay; encrypted-media");
                  iframe.setAttribute("tabindex", "-1");
                  iframe.setAttribute(
                    "title",
                    "光復國小校園大冒險背景音樂 YouTube 播放器"
                  );
                }
                ev.target.setVolume(volumeRef.current);
                if (mutedRef.current) {
                  ev.target.mute();
                } else {
                  ev.target.unMute();
                }
                if (wantPlayRef.current && modeRef.current === "youtube") {
                  ev.target.playVideo();
                }
              } catch {
                // ignore
              }
            },
            onStateChange: (ev) => {
              if (modeRef.current !== "youtube") return;
              const code = ev.data;
              if (code === 1) {
                clearFallbackTimer();
                setIsLoading(false);
                setIsPlaying(true);
                setNotice(null);
                try {
                  setDuration(ev.target.getDuration() || 0);
                } catch {
                  // ignore
                }
              } else if (code === 2) {
                if (!wantPlayRef.current) {
                  setIsPlaying(false);
                  setIsLoading(false);
                }
              } else if (code === 3) {
                if (wantPlayRef.current) setIsLoading(true);
              } else if (code === 0 && wantPlayRef.current) {
                const next = pickNextIndex(
                  trackIdxRef.current,
                  repeatRef.current
                );
                if (next === trackIdxRef.current) {
                  ev.target.seekTo(0, true);
                  ev.target.playVideo();
                } else {
                  playTrackRef.current(next, "youtube");
                }
              }
            },
            onError: () => {
              ytCreatingRef.current = false;
              if (wantPlayRef.current && modeRef.current === "youtube") {
                fallbackToSynth(
                  "此環境無法直接嵌播 YouTube，已自動切換為內建舒緩伴奏",
                  trackIdxRef.current
                );
              }
            },
          },
        });
      } catch {
        ytCreatingRef.current = false;
        if (wantPlayRef.current && modeRef.current === "youtube") {
          fallbackToSynth(
            "無法連線 YouTube 播放器，已自動啟用內建舒緩伴奏",
            trackIdxRef.current
          );
        }
      }
    },
    [clearFallbackTimer, fallbackToSynth, pauseSynth, pickNextIndex]
  );

  const playTrack = useCallback(
    (idx: number, forceMode?: AudioMode) => {
      const mode = forceMode ?? modeRef.current;
      wantPlayRef.current = true;
      userPausedRef.current = false;
      writeStorage(STORAGE_USER_PAUSED, "0");

      setTrackIdx(idx);
      trackIdxRef.current = idx;
      setAudioMode(mode);
      modeRef.current = mode;

      // Unlock Web Audio right inside user gesture for guaranteed seamless fallback
      const synth = ensureSynth();
      synth.unlock();

      if (mode === "youtube") {
        setNotice(null);
        setIsPlaying(true);
        startYouTube(idx);
      } else {
        pauseYouTube();
        setIsLoading(false);
        setNotice(null);
        synth.setVolume(volumeRef.current);
        synth.setMuted(mutedRef.current);
        synth.start(MUSIC_PLAYLIST[idx], true);
        setIsPlaying(true);
      }
    },
    [ensureSynth, pauseYouTube, startYouTube]
  );

  playTrackRef.current = playTrack;

  const stopPlayback = useCallback(
    (markUserPaused = true) => {
      wantPlayRef.current = false;
      if (markUserPaused) {
        userPausedRef.current = true;
        writeStorage(STORAGE_USER_PAUSED, "1");
      }
      setIsPlaying(false);
      setIsLoading(false);
      pauseYouTube();
      pauseSynth();
    },
    [pauseSynth, pauseYouTube]
  );

  const togglePlay = useCallback(() => {
    if (isPlaying || isLoading) {
      stopPlayback(true);
      return;
    }
    wantPlayRef.current = true;
    userPausedRef.current = false;
    writeStorage(STORAGE_USER_PAUSED, "0");

    if (modeRef.current === "youtube") {
      if (ytPlayerRef.current && ytReadyRef.current) {
        try {
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
          return;
        } catch {
          // reload below
        }
      }
      playTrack(trackIdxRef.current, "youtube");
    } else if (synthRef.current && currentTime > 0) {
      synthRef.current.resume();
      setIsPlaying(true);
    } else {
      playTrack(trackIdxRef.current, "synth");
    }
  }, [currentTime, isLoading, isPlaying, playTrack, stopPlayback]);

  const startIfAllowed = useCallback(() => {
    if (wantPlayRef.current || isPlaying || isLoading) return;
    if (userPausedRef.current || mutedRef.current) return;
    playTrack(trackIdxRef.current);
  }, [isLoading, isPlaying, playTrack]);

  const nextTrack = useCallback(() => {
    const next = pickNextIndex(trackIdxRef.current, repeatRef.current, true);
    playTrack(next);
  }, [pickNextIndex, playTrack]);

  const prevTrack = useCallback(() => {
    const prev =
      (trackIdxRef.current - 1 + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length;
    playTrack(prev);
  }, [playTrack]);

  const randomTrack = useCallback(() => {
    let pick = trackIdxRef.current;
    while (pick === trackIdxRef.current && MUSIC_PLAYLIST.length > 1) {
      pick = Math.floor(Math.random() * MUSIC_PLAYLIST.length);
    }
    playTrack(pick);
  }, [playTrack]);

  const switchSourceMode = useCallback(
    (nextMode: AudioMode) => {
      if (nextMode === modeRef.current) return;
      if (isPlaying || isLoading) {
        playTrack(trackIdxRef.current, nextMode);
      } else {
        setAudioMode(nextMode);
        modeRef.current = nextMode;
        setNotice(null);
        setCurrentTime(0);
        setDuration(0);
      }
    },
    [isLoading, isPlaying, playTrack]
  );

  const handleVolumeChange = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(value)));
    const isNowMuted = clamped === 0;
    setVolume(clamped);
    setMuted(isNowMuted);
    if (
      modeRef.current === "youtube" &&
      ytPlayerRef.current &&
      ytReadyRef.current
    ) {
      try {
        ytPlayerRef.current.setVolume(clamped);
        if (isNowMuted) ytPlayerRef.current.mute();
        else ytPlayerRef.current.unMute();
      } catch {
        // ignore
      }
    }
    synthRef.current?.setVolume(clamped);
    synthRef.current?.setMuted(isNowMuted);
  }, []);

  const applyMute = useCallback((nextMuted: boolean) => {
    setMuted(nextMuted);
    if (ytPlayerRef.current && ytReadyRef.current) {
      try {
        if (nextMuted) {
          ytPlayerRef.current.mute();
        } else {
          ytPlayerRef.current.unMute();
          ytPlayerRef.current.setVolume(volumeRef.current);
        }
      } catch {
        // ignore
      }
    }
    synthRef.current?.setMuted(nextMuted);
  }, []);

  const toggleMute = useCallback(() => {
    if (mutedRef.current && volumeRef.current === 0) {
      handleVolumeChange(65);
      return;
    }
    applyMute(!mutedRef.current);
  }, [applyMute, handleVolumeChange]);

  const handleSeek = useCallback(
    (ratio: number) => {
      if (duration <= 0) return;
      const target = Math.max(0, Math.min(duration, ratio * duration));
      if (audioMode === "youtube" && ytPlayerRef.current && ytReadyRef.current) {
        try {
          ytPlayerRef.current.seekTo(target, true);
          setCurrentTime(target);
        } catch {
          // ignore
        }
      } else if (audioMode === "synth" && synthRef.current) {
        synthRef.current.seekTo(target);
        setCurrentTime(target);
      }
    },
    [audioMode, duration]
  );

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((prev) =>
      prev === "list" ? "one" : prev === "one" ? "shuffle" : "list"
    );
  }, []);

  // Register interactive controls into bridge
  useEffect(() => {
    bgmBridge.registerActions({
      togglePlay,
      startIfAllowed,
      pause: () => stopPlayback(false),
      togglePanel: () => setIsOpen((v) => !v),
      setOpen: (v: boolean) => setIsOpen(v),
      nextTrack,
      randomTrack,
      setGlobalMute: applyMute,
    });
  }, [
    applyMute,
    nextTrack,
    randomTrack,
    startIfAllowed,
    stopPlayback,
    togglePlay,
  ]);

  // Live poll playback time for active YouTube audio
  useEffect(() => {
    if (!isPlaying || audioMode !== "youtube") return;
    const id = window.setInterval(() => {
      if (ytPlayerRef.current && ytReadyRef.current) {
        try {
          const cur = ytPlayerRef.current.getCurrentTime();
          const dur = ytPlayerRef.current.getDuration();
          if (Number.isFinite(cur)) setCurrentTime(cur);
          if (Number.isFinite(dur) && dur > 0) setDuration(dur);
        } catch {
          // ignore
        }
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [isPlaying, audioMode]);

  // Keep the currently active track smoothly visible in the playlist when opened or changed
  useEffect(() => {
    if (!isOpen) return;
    activeRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isOpen, trackIdx]);

  // Escape collapses panel cleanly
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Clean shutdown on unmount
  useEffect(() => {
    return () => {
      clearFallbackTimer();
      synthRef.current?.destroy();
      try {
        ytPlayerRef.current?.destroy();
      } catch {
        // ignore
      }
    };
  }, [clearFallbackTimer]);

  const progressPct =
    duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const repeatTitle =
    repeatMode === "list"
      ? "循環模式：清單依序循環"
      : repeatMode === "one"
        ? "循環模式：單曲循環"
        : "循環模式：隨機播放";

  // Mirror reference site's iconic bottom-left corner inside 3D Campus Quest
  // (completely clear of the bottom-right minimap and center street crossing signal).
  // On the Title Screen, expand neatly above the bottom-right Soundtrack bar.
  const positionClass = inGame
    ? "left-3 sm:left-5 bottom-4 sm:bottom-5 items-start"
    : "right-3 sm:right-6 bottom-[122px] sm:bottom-[142px] items-end";

  const showFloatingPill = inGame && !hasOtherModal;
  const panelMaxHeight = inGame
    ? "calc(100dvh - 148px)"
    : "calc(100dvh - 166px)";

  return (
    <>
      {/* Hidden YouTube IFrame audio mount (persists smoothly from Title Screen into 3D Campus) */}
      <div
        ref={ytHostRef}
        aria-hidden="true"
        className="pointer-events-none fixed -left-[9999px] -top-[9999px] h-[135px] w-[240px] overflow-hidden opacity-0"
      />

      {/* Subtle click-away scrim when panel is expanded */}
      {isOpen && (
        <div
          aria-hidden="true"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[55] bg-black/22 transition-opacity"
        />
      )}

      {(isOpen || showFloatingPill) && (
        <div
          data-bgm-player="true"
          className={`fixed z-[60] flex max-w-[calc(100vw-24px)] flex-col gap-2.5 transition-all duration-300 sm:max-w-[392px] ${positionClass}`}
        >
          {/* Full Expandable Frosted-Glass Background Music Player Panel (referenced from 光復管樂) */}
          {isOpen && (
            <section
              role="dialog"
              aria-label="校園大冒險背景音樂播放器"
              className="animate-panel-up flex w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-white/18 bg-[#121110]/90 text-stone-100 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_25px_60px_-15px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:w-[392px]"
              style={{ maxHeight: panelMaxHeight }}
            >
              {/* Panel Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 bg-gradient-to-r from-red-950/65 via-stone-900/55 to-stone-950/60 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-700 shadow shadow-red-950">
                    <Music size={15} className="text-white" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-xs font-semibold tracking-wide text-stone-50">
                      背景音樂 · 隨機精選 8 首
                    </h3>
                    <a
                      href={SOURCE_PLAYLIST_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-stone-300/85 transition-colors hover:text-red-300"
                    >
                      <span>YouTube 混播清單來源</span>
                      <ExternalLink size={9} />
                    </a>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={randomTrack}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] text-stone-100 transition hover:bg-red-700/60 hover:text-white"
                    title="隨機挑選一首播放"
                  >
                    <Shuffle size={12} />
                    <span>隨機</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="cursor-pointer rounded-lg p-1.5 text-stone-300 transition hover:bg-white/15 hover:text-white"
                    aria-label="收合音樂選單"
                    title="收合音樂選單"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Now Playing Info + Controls */}
              <div className="shrink-0 space-y-3 border-b border-white/10 bg-stone-950/45 p-4">
                <div className="flex items-center gap-3">
                  {/* Cover Thumbnail + Spinning Disc Overlay */}
                  <div
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-gradient-to-br shadow-md ${currentTrack.fallbackGradient}`}
                  >
                    {!thumbFailed && (
                      <img
                        src={getYouTubeThumbnailUrl(currentTrack.videoId)}
                        alt={currentTrack.zhTitle}
                        referrerPolicy="no-referrer"
                        onError={() => setThumbFailed(true)}
                        className={`h-full w-full object-cover transition-transform duration-700 ${
                          isPlaying
                            ? "scale-105 opacity-95"
                            : "scale-100 opacity-85"
                        }`}
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/28">
                      <Disc3
                        size={20}
                        className={`text-white/95 drop-shadow ${
                          isPlaying ? "animate-spin" : ""
                        }`}
                        style={
                          isPlaying ? { animationDuration: "5s" } : undefined
                        }
                      />
                    </div>
                  </div>

                  {/* Active Track Title & Metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none ${currentTrack.accentColor}`}
                      >
                        {currentTrack.mood}
                      </span>
                      <span className="font-mono text-[10px] text-stone-400">
                        {String(currentTrack.id).padStart(2, "0")} / 08
                      </span>
                    </div>
                    <p className="truncate font-serif text-sm font-semibold text-stone-50">
                      {currentTrack.zhTitle}
                    </p>
                    <p className="truncate text-[11px] text-stone-300/80">
                      {currentTrack.title} · {currentTrack.artist}
                    </p>
                  </div>

                  <a
                    href={getYouTubeWatchUrl(currentTrack.videoId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg p-2 text-stone-300 transition hover:bg-white/12 hover:text-red-300"
                    title="前往 YouTube 開啟原曲"
                    aria-label={`前往 YouTube 開啟 ${currentTrack.zhTitle}`}
                  >
                    <ExternalLink size={15} />
                  </a>
                </div>

                {/* Seekable Progress Bar */}
                <div className="space-y-1">
                  <div
                    role="slider"
                    aria-label="播放進度"
                    aria-valuemin={0}
                    aria-valuemax={Math.round(duration)}
                    aria-valuenow={Math.round(currentTime)}
                    tabIndex={0}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      handleSeek((e.clientX - rect.left) / rect.width);
                    }}
                    onKeyDown={(e) => {
                      if (duration <= 0) return;
                      if (e.key === "ArrowRight") {
                        e.preventDefault();
                        handleSeek(Math.min(1, (currentTime + 5) / duration));
                      } else if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        handleSeek(Math.max(0, (currentTime - 5) / duration));
                      }
                    }}
                    className={`h-1.5 w-full overflow-hidden rounded-full bg-white/15 ${
                      duration > 0 ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isLoading
                          ? "w-1/3 animate-pulse bg-amber-400/90"
                          : "bg-gradient-to-r from-red-600 to-amber-400"
                      }`}
                      style={
                        isLoading ? undefined : { width: `${progressPct}%` }
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px] text-stone-400">
                    <span>
                      {isLoading ? "正在載入音訊…" : formatTime(currentTime)}
                    </span>
                    <span className="font-sans text-stone-400">
                      {currentTrack.recommendedFor}
                    </span>
                    <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
                  </div>
                </div>

                {/* Playback Transport & Volume Controls */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={cycleRepeatMode}
                      className={`cursor-pointer rounded-lg p-2 transition ${
                        repeatMode === "list"
                          ? "text-stone-300 hover:bg-white/12 hover:text-white"
                          : "bg-red-900/55 text-red-200 hover:bg-red-800/65"
                      }`}
                      title={repeatTitle}
                      aria-label={repeatTitle}
                    >
                      {repeatMode === "one" ? (
                        <Repeat1 size={15} />
                      ) : repeatMode === "shuffle" ? (
                        <Shuffle size={15} />
                      ) : (
                        <Repeat size={15} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={prevTrack}
                      className="cursor-pointer rounded-lg p-2 text-stone-200 transition hover:bg-white/12 hover:text-white"
                      title="上一首"
                      aria-label="上一首"
                    >
                      <SkipBack size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={togglePlay}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-red-700 text-white shadow-lg shadow-red-950/75 transition hover:bg-red-600 active:scale-95"
                      title={isPlaying ? "暫停" : "播放"}
                      aria-label={isPlaying ? "暫停背景音樂" : "播放背景音樂"}
                    >
                      {isPlaying ? (
                        <Pause size={17} className="fill-current" />
                      ) : (
                        <Play size={17} className="ml-0.5 fill-current" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={nextTrack}
                      className="cursor-pointer rounded-lg p-2 text-stone-200 transition hover:bg-white/12 hover:text-white"
                      title="下一首"
                      aria-label="下一首"
                    >
                      <SkipForward size={16} />
                    </button>
                  </div>

                  {/* Volume Slider & Mute Toggle */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="cursor-pointer rounded-md p-1.5 text-stone-300 transition hover:bg-white/10 hover:text-white"
                      aria-label={muted || volume === 0 ? "取消靜音" : "靜音"}
                      title={
                        muted || volume === 0
                          ? "取消靜音"
                          : `靜音（目前音量 ${volume}%）`
                      }
                    >
                      {muted || volume === 0 ? (
                        <VolumeX size={15} className="text-red-300" />
                      ) : (
                        <Volume2 size={15} />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={muted ? 0 : volume}
                      onChange={(e) =>
                        handleVolumeChange(Number(e.target.value))
                      }
                      aria-label="背景音樂音量"
                      className="h-1 w-16 cursor-pointer rounded-lg bg-white/20 accent-red-500 sm:w-20"
                    />
                  </div>
                </div>

                {/* Audio Source Mode Toggle (YouTube Original vs Built-in Soothing Synth) */}
                <div className="flex items-center justify-between gap-2 pt-1 text-[10px]">
                  <span className="text-stone-400">音源模式</span>
                  <div
                    className="inline-flex rounded-lg border border-white/12 bg-white/6 p-0.5"
                    role="group"
                    aria-label="背景音樂音源模式"
                  >
                    <button
                      type="button"
                      onClick={() => switchSourceMode("youtube")}
                      aria-pressed={audioMode === "youtube"}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 transition ${
                        audioMode === "youtube"
                          ? "bg-red-600/85 font-medium text-white shadow-sm"
                          : "text-stone-300 hover:text-white"
                      }`}
                      title="直接串流 YouTube 音頻庫原曲"
                    >
                      <Radio size={10} />
                      <span>YouTube 原曲</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => switchSourceMode("synth")}
                      aria-pressed={audioMode === "synth"}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 transition ${
                        audioMode === "synth"
                          ? "bg-amber-600/85 font-medium text-white shadow-sm"
                          : "text-stone-300 hover:text-white"
                      }`}
                      title="免網路即時合成舒緩伴奏"
                    >
                      <Sparkles size={10} />
                      <span>舒緩伴奏</span>
                    </button>
                  </div>
                </div>

                {/* Graceful Fallback Status Notice */}
                {notice && (
                  <p
                    role="status"
                    className="rounded-lg border border-amber-500/40 bg-amber-950/60 px-2.5 py-1.5 text-[11px] leading-snug text-amber-200"
                  >
                    {notice}
                  </p>
                )}
              </div>

              {/* Scrollable 8-Track Song List */}
              <div className="max-h-[224px] min-h-0 flex-1 divide-y divide-white/8 overflow-y-auto bg-stone-950/35 sm:max-h-[252px]">
                {MUSIC_PLAYLIST.map((track, idx) => {
                  const isSelected = idx === trackIdx;
                  const isActivePlaying = isSelected && isPlaying;
                  return (
                    <div
                      key={track.videoId}
                      ref={isSelected ? activeRowRef : undefined}
                      className={`flex items-center gap-2 px-3.5 py-2.5 transition-colors ${
                        isSelected ? "bg-red-950/48" : "hover:bg-white/7"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isSelected && (isPlaying || isLoading)) {
                            stopPlayback(true);
                          } else {
                            playTrack(idx);
                          }
                        }}
                        className="group flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
                      >
                        <span className="w-6 shrink-0 text-center font-mono text-[11px]">
                          {isActivePlaying ? (
                            <span
                              className="bgm-eq-bars inline-flex h-3.5 items-end justify-center gap-[2px]"
                              aria-label="播放中"
                            >
                              <span />
                              <span />
                              <span />
                            </span>
                          ) : (
                            <span
                              className={
                                isSelected
                                  ? "font-bold text-red-400"
                                  : "text-stone-400 group-hover:text-stone-200"
                              }
                            >
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-xs font-medium ${
                              isSelected
                                ? "text-red-200"
                                : "text-stone-100 group-hover:text-white"
                            }`}
                          >
                            {track.zhTitle}
                            <span className="ml-1.5 text-[10px] font-normal text-stone-400">
                              {track.title}
                            </span>
                          </p>
                          <p className="truncate text-[10px] text-stone-400">
                            {track.artist} · {track.playlist}
                          </p>
                        </div>
                        <span
                          className={`hidden shrink-0 rounded border px-1.5 py-0.5 text-[10px] sm:inline-block ${track.accentColor}`}
                        >
                          {track.mood}
                        </span>
                      </button>
                      <a
                        href={getYouTubeWatchUrl(track.videoId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 p-1 text-stone-400 transition hover:text-stone-100"
                        title={`在 YouTube 聆聽 ${track.title}`}
                        aria-label={`在 YouTube 開啟 ${track.zhTitle}`}
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Persistent Floating Glass Capsule Mini-Player (in-game bottom-left, matches 光復管樂 reference site) */}
          {showFloatingPill && (
            <div
              className={`hidden items-center gap-2 rounded-full border py-1.5 pl-2 pr-2.5 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.65)] backdrop-blur-2xl transition-all duration-300 sm:flex ${
                isPlaying
                  ? "border-red-500/60 bg-[#141211]/88 shadow-red-950/40"
                  : "border-white/22 bg-[#141211]/82 shadow-black/50 hover:border-white/38"
              }`}
            >
              <button
                type="button"
                onClick={togglePlay}
                aria-label={isPlaying ? "暫停背景音樂" : "播放背景音樂"}
                title={isPlaying ? "暫停背景音樂" : "播放背景音樂"}
                className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all ${
                  isPlaying
                    ? "bg-red-700 text-white shadow-md shadow-red-950 hover:bg-red-600"
                    : "bg-white/15 text-stone-100 hover:bg-red-700"
                }`}
              >
                {isPlaying ? (
                  <Pause size={15} className="fill-current" />
                ) : (
                  <Play size={15} className="ml-0.5 fill-current" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                className="group flex min-w-0 max-w-[190px] cursor-pointer items-center gap-2 pr-1 text-left"
                title="展開 8 首背景音樂選單"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isPlaying && (
                      <span className="bgm-eq-bars inline-flex h-2.5 shrink-0 items-end gap-[2px]">
                        <span />
                        <span />
                        <span />
                      </span>
                    )}
                    <span className="truncate text-xs font-medium text-stone-50 transition-colors group-hover:text-red-300">
                      {currentTrack.zhTitle}
                    </span>
                  </div>
                  <span className="block truncate text-[10px] text-stone-300/85">
                    {isLoading
                      ? "載入音樂中…"
                      : isPlaying
                        ? `${currentTrack.artist} · ${
                            audioMode === "youtube" ? "YouTube" : "伴奏"
                          }`
                        : "點此選擇 8 首背景音樂"}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={nextTrack}
                className="inline-flex cursor-pointer rounded-full p-1.5 text-stone-300 transition hover:bg-white/12 hover:text-white"
                aria-label="切換下一首背景音樂"
                title="下一首"
              >
                <SkipForward size={14} />
              </button>

              <button
                type="button"
                onClick={() => setIsOpen((v) => !v)}
                className={`cursor-pointer rounded-full p-1.5 transition ${
                  isOpen
                    ? "bg-red-900/55 text-red-200"
                    : "text-stone-300 hover:bg-white/12 hover:text-white"
                }`}
                aria-label={isOpen ? "收合音樂選單" : "展開音樂選單"}
                title={isOpen ? "收合音樂選單" : "選擇背景音樂（8 首）"}
              >
                {isOpen ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
};
