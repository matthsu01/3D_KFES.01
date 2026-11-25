import { useEffect, useRef } from "react";
import "./audio/bgmBridge";
import { BackgroundMusicPlayer } from "./components/BackgroundMusicPlayer";
import { mountCampusQuest } from "./game/campusQuest.js";

export function App() {
  const gameContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = gameContainerRef.current;
    if (!el) return;
    const unmount = mountCampusQuest(el);
    return () => {
      unmount();
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={gameContainerRef}
        className="relative h-full w-full overflow-hidden"
      />
      <BackgroundMusicPlayer />
    </div>
  );
}

export default App;
