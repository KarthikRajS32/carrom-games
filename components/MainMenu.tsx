import React, { useState, useEffect } from 'react';
import { Difficulty, GameSettings, PlayMode } from '../types';

interface MainMenuProps {
  onStart: (settings: GameSettings) => void;
}

enum MenuState {
  MAIN,
  MULTIPLAYER,
  CREATE_ROOM,
  JOIN_ROOM
}

const MainMenu: React.FC<MainMenuProps> = ({ onStart }) => {
  const [menuState, setMenuState] = useState<MenuState>(MenuState.MAIN);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [sound, setSound] = useState<boolean>(true);
  
  // Room State
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    // Cleanup any pending channel connections when switching menus
    return () => {};
  }, [menuState]);

  const startAI = () => {
    onStart({ playMode: PlayMode.AI, difficulty, soundEnabled: sound });
  };

  const startLocal = () => {
    onStart({ playMode: PlayMode.LOCAL, difficulty, soundEnabled: sound });
  };

  const createRoom = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRoomCode(code);
    setMenuState(MenuState.CREATE_ROOM);
    setStatus('Waiting for opponent...');
    
    const channel = new BroadcastChannel(`carrom_room_${code}`);
    channel.onmessage = (ev) => {
      if (ev.data.type === 'JOIN') {
        // Opponent joined! Start game as Host
        channel.postMessage({ type: 'START' });
        channel.close();
        onStart({ 
          playMode: PlayMode.ONLINE, 
          difficulty, 
          soundEnabled: sound, 
          roomId: code, 
          isHost: true 
        });
      }
    };
  };

  const joinRoom = () => {
    if (joinCode.length !== 4) return;
    setStatus('Connecting...');
    
    const channel = new BroadcastChannel(`carrom_room_${joinCode}`);
    channel.postMessage({ type: 'JOIN' });
    
    channel.onmessage = (ev) => {
      if (ev.data.type === 'START') {
        // Host started game! Start game as Client
        channel.close();
        onStart({ 
          playMode: PlayMode.ONLINE, 
          difficulty, 
          soundEnabled: sound, 
          roomId: joinCode, 
          isHost: false 
        });
      }
    };
  };

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-stone-900 text-amber-50 z-50">
      <h1 className="text-6xl font-bold mb-8 text-amber-400 tracking-wider">CARROM MASTER</h1>
      
      <div className="bg-stone-800 p-8 rounded-lg shadow-2xl border border-stone-600 w-96 relative">
        {menuState !== MenuState.MAIN && (
            <button 
              onClick={() => setMenuState(MenuState.MAIN)}
              className="absolute top-4 left-4 text-stone-400 hover:text-white"
            >
              ← Back
            </button>
        )}

        {menuState === MenuState.MAIN && (
          <div className="space-y-6">
            <button 
              onClick={startAI}
              className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-md font-bold text-xl transition-all shadow-lg transform hover:scale-105"
            >
              Play vs AI
            </button>
            
            <button 
              onClick={() => setMenuState(MenuState.MULTIPLAYER)}
              className="w-full py-4 bg-stone-600 hover:bg-stone-500 text-white rounded-md font-bold text-xl transition-all shadow-lg"
            >
              Two Player
            </button>

            <div className="pt-4 border-t border-stone-600">
              <label className="block text-sm font-medium mb-2 text-stone-400">AI Difficulty</label>
              <div className="flex gap-2">
                {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={`flex-1 py-2 text-sm rounded ${difficulty === d ? 'bg-amber-700 text-white' : 'bg-stone-700 text-gray-400'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
               <span className="text-stone-400">Sound Effects</span>
               <button 
                 onClick={() => setSound(!sound)}
                 className={`w-12 h-6 rounded-full p-1 transition-colors ${sound ? 'bg-green-600' : 'bg-gray-600'}`}
               >
                 <div className={`w-4 h-4 bg-white rounded-full transition-transform ${sound ? 'translate-x-6' : ''}`} />
               </button>
            </div>
          </div>
        )}

        {menuState === MenuState.MULTIPLAYER && (
          <div className="space-y-6 mt-4">
            <button 
              onClick={startLocal}
              className="w-full py-3 bg-stone-700 hover:bg-stone-600 text-white rounded-md font-bold text-lg"
            >
              Local Player (Same Device)
            </button>
            <button 
              onClick={createRoom}
              className="w-full py-3 bg-stone-700 hover:bg-stone-600 text-white rounded-md font-bold text-lg"
            >
              Create Room
            </button>
            <button 
              onClick={() => setMenuState(MenuState.JOIN_ROOM)}
              className="w-full py-3 bg-stone-700 hover:bg-stone-600 text-white rounded-md font-bold text-lg"
            >
              Join Room
            </button>
          </div>
        )}

        {menuState === MenuState.CREATE_ROOM && (
          <div className="text-center space-y-6 mt-4">
            <div>
              <div className="text-stone-400 text-sm mb-2">Room Code</div>
              <div className="text-5xl font-mono font-bold text-amber-400 tracking-widest">{roomCode}</div>
            </div>
            <div className="text-stone-300 animate-pulse">{status}</div>
            <p className="text-xs text-stone-500">Share this code with your friend. <br/>Note: Must be on same local network/browser.</p>
          </div>
        )}

        {menuState === MenuState.JOIN_ROOM && (
          <div className="text-center space-y-6 mt-4">
            <div>
              <label className="text-stone-400 text-sm mb-2 block">Enter Room Code</label>
              <input 
                type="text" 
                maxLength={4}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g,''))}
                className="w-32 text-center text-3xl font-mono bg-stone-900 border border-stone-600 text-white rounded p-2 focus:border-amber-500 outline-none"
              />
            </div>
            <button 
              onClick={joinRoom}
              disabled={joinCode.length !== 4}
              className="w-full py-3 bg-amber-600 disabled:bg-stone-700 disabled:text-stone-500 hover:bg-amber-500 text-white rounded-md font-bold text-lg transition-colors"
            >
              Join
            </button>
            <div className="text-stone-300 text-sm">{status}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MainMenu;