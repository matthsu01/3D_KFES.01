export type MusicTimbre = "piano" | "flute" | "strings" | "waltz" | "brass";

export type AudioMode = "youtube" | "synth";

export type RepeatMode = "list" | "one" | "shuffle";

export interface MelodyStep {
  melody?: number;
  chord?: number[];
  beats: number;
}

export interface MusicTrack {
  id: number;
  videoId: string;
  title: string;
  zhTitle: string;
  artist: string;
  playlist: string;
  playlistId: string;
  mood: string;
  recommendedFor: string;
  accentColor: string;
  fallbackGradient: string;
  bpm: number;
  tonic: number;
  timbre: MusicTimbre;
  pattern: MelodyStep[];
}

export const SOURCE_PLAYLIST_URL =
  "https://youtube.com/playlist?list=RD_LIclpElIuk&playnext=1";

export function getYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

// I - vi - IV - V - I - IV - V - I warm healing chord progression (intervals in semitones)
const CHORD_PROGRESSION: number[][] = [
  [0, 4, 7],
  [9, 12, 16],
  [5, 9, 12],
  [7, 11, 14],
  [0, 4, 7],
  [5, 9, 12],
  [7, 11, 14],
  [0, 4, 7],
];

function buildPattern(tonic: number, flowing: boolean): MelodyStep[] {
  const steps: MelodyStep[] = [];
  CHORD_PROGRESSION.forEach((triad, barIdx) => {
    const chord = triad.map((interval) => tonic + interval - 12);
    if (flowing) {
      const order = barIdx % 2 === 0 ? [0, 1, 2, 1] : [1, 2, 1, 0];
      order.forEach((idx, stepIdx) => {
        const melody = tonic + triad[idx] + 12;
        steps.push(
          stepIdx === 0 ? { melody, chord, beats: 1 } : { melody, beats: 1 }
        );
      });
    } else {
      const order = barIdx % 2 === 0 ? [2, 1] : [1, 0];
      order.forEach((idx, stepIdx) => {
        const melody = tonic + triad[idx] + 12;
        steps.push(
          stepIdx === 0 ? { melody, chord, beats: 2 } : { melody, beats: 2 }
        );
      });
    }
  });
  return steps;
}

interface RawTrack extends Omit<MusicTrack, "pattern"> {
  flowing: boolean;
}

function createTrack({ flowing, ...rest }: RawTrack): MusicTrack {
  return {
    ...rest,
    pattern: buildPattern(rest.tonic, flowing),
  };
}

export const MUSIC_PLAYLIST: MusicTrack[] = [
  createTrack({
    id: 1,
    videoId: "VjXAOh81YYM",
    title: "歲月祝福 | 溫和浪漫的放鬆音樂 - 逾越時光",
    zhTitle: "歲月祝福",
    artist: "Something Soothing",
    playlist: "療癒放鬆混播清單",
    playlistId: "RD_LIclpElIuk",
    mood: "溫和浪漫",
    recommendedFor: "溫馨校園漫步",
    accentColor: "text-rose-300 bg-rose-950/60 border-rose-700/60",
    fallbackGradient: "from-rose-800 via-rose-950 to-stone-900",
    bpm: 66,
    tonic: 60,
    timbre: "piano",
    flowing: false,
  }),
  createTrack({
    id: 2,
    videoId: "iW1cmQ_o2Tw",
    title: "心願 | 動人優美鋼琴睡眠音樂, 寧靜地",
    zhTitle: "心願",
    artist: "Something Soothing",
    playlist: "療癒放鬆混播清單",
    playlistId: "RD_LIclpElIuk",
    mood: "寧靜優美",
    recommendedFor: "深夜靜靜探索",
    accentColor: "text-sky-300 bg-sky-950/60 border-sky-700/60",
    fallbackGradient: "from-sky-800 via-slate-900 to-stone-950",
    bpm: 60,
    tonic: 57,
    timbre: "piano",
    flowing: false,
  }),
  createTrack({
    id: 3,
    videoId: "sbPYb5FyYaI",
    title: "甜甜英文歌 | 放鬆的好聽英文音樂・療癒讀書 BGM",
    zhTitle: "甜甜英文歌",
    artist: "樂來樂愛Music",
    playlist: "療癒放鬆混播清單",
    playlistId: "RD_LIclpElIuk",
    mood: "甜美輕快",
    recommendedFor: "歡樂超商散步",
    accentColor: "text-amber-300 bg-amber-950/60 border-amber-700/60",
    fallbackGradient: "from-amber-700 via-amber-950 to-stone-900",
    bpm: 92,
    tonic: 62,
    timbre: "flute",
    flowing: true,
  }),
  createTrack({
    id: 4,
    videoId: "pKkL8kPWLDY",
    title: "夢境森林‧重製版 | 夢幻靜心放鬆音樂",
    zhTitle: "夢境森林",
    artist: "Something Soothing",
    playlist: "療癒放鬆混播清單",
    playlistId: "RD_LIclpElIuk",
    mood: "夢幻靜心",
    recommendedFor: "林蔭校園沉澱",
    accentColor: "text-emerald-300 bg-emerald-950/60 border-emerald-700/60",
    fallbackGradient: "from-emerald-800 via-teal-950 to-stone-950",
    bpm: 63,
    tonic: 55,
    timbre: "strings",
    flowing: false,
  }),
  createTrack({
    id: 5,
    videoId: "ANx4K5cl-7o",
    title: "流星祝福 | 寧心安神放鬆音樂 - 下班後的小確幸",
    zhTitle: "流星祝福",
    artist: "Something Soothing",
    playlist: "療癒放鬆混播清單",
    playlistId: "RD_LIclpElIuk",
    mood: "寧心安神",
    recommendedFor: "悠閒自動播放",
    accentColor: "text-violet-300 bg-violet-950/60 border-violet-700/60",
    fallbackGradient: "from-violet-800 via-indigo-950 to-stone-950",
    bpm: 70,
    tonic: 60,
    timbre: "piano",
    flowing: true,
  }),
  createTrack({
    id: 6,
    videoId: "yFP77DXm8DQ",
    title: "日落茶座 | 寧神減壓放鬆音樂 - 給辛勞一天的你",
    zhTitle: "日落茶座",
    artist: "Something Soothing",
    playlist: "療癒放鬆混播清單",
    playlistId: "RD_LIclpElIuk",
    mood: "溫暖減壓",
    recommendedFor: "午後休息片刻",
    accentColor: "text-orange-300 bg-orange-950/60 border-orange-700/60",
    fallbackGradient: "from-orange-700 via-stone-900 to-stone-950",
    bpm: 68,
    tonic: 58,
    timbre: "waltz",
    flowing: false,
  }),
  createTrack({
    id: 7,
    videoId: "59N2JIPWqD4",
    title: "雪印星海 | 喚起回憶的放鬆療癒音樂",
    zhTitle: "雪印星海",
    artist: "Something Soothing",
    playlist: "療癒放鬆混播清單",
    playlistId: "RD_LIclpElIuk",
    mood: "回憶療癒",
    recommendedFor: "重溫校園時光",
    accentColor: "text-cyan-300 bg-cyan-950/60 border-cyan-700/60",
    fallbackGradient: "from-cyan-800 via-slate-900 to-stone-950",
    bpm: 64,
    tonic: 62,
    timbre: "strings",
    flowing: true,
  }),
  createTrack({
    id: 8,
    videoId: "Op26ZNX0IEQ",
    title: "吉卜力 OST 音樂盒鋼琴集 | 鄰家豆豆龍・神隱少女",
    zhTitle: "吉卜力鋼琴集",
    artist: "BGM Ghibli Relaxation",
    playlist: "療癒放鬆混播清單",
    playlistId: "RD_LIclpElIuk",
    mood: "童話音樂盒",
    recommendedFor: "全家一起冒險",
    accentColor: "text-lime-300 bg-lime-950/60 border-lime-700/60",
    fallbackGradient: "from-lime-800 via-emerald-950 to-stone-950",
    bpm: 76,
    tonic: 60,
    timbre: "piano",
    flowing: true,
  }),
];
