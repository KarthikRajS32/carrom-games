import React, { useState } from 'react';
import MainMenu from './components/MainMenu';
import GameCanvas from './components/GameCanvas';
import { GameMode, GameSettings, Difficulty, PlayMode } from './types';

function App() {
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  const [settings, setSettings] = useState<GameSettings>({
    playMode: PlayMode.AI,
    difficulty: Difficulty.MEDIUM,
    soundEnabled: true
  });

  const handleStartGame = (newSettings: GameSettings) => {
    setSettings(newSettings);
    setMode(GameMode.PLAYING);
  };

  const handleExitGame = () => {
    setMode(GameMode.MENU);
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-stone-950">
      {mode === GameMode.MENU && <MainMenu onStart={handleStartGame} />}
      {mode === GameMode.PLAYING && <GameCanvas settings={settings} onExit={handleExitGame} />}
    </div>
  );
}

export default App;