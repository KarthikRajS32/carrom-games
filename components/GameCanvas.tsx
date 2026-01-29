
import React, { useEffect, useRef, useState } from 'react';
import { CarromEngine } from '../classes/CarromEngine';
import { GameSettings, GameMode, PlayMode, GameScore, CoinType, GamePhase } from '../types';
import { TURN_TIME_LIMIT } from '../constants';
import UIOverlay from './UIOverlay';

interface GameCanvasProps {
  settings: GameSettings;
  onExit: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ settings, onExit }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CarromEngine | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  
  // Fix: Explicitly type the state to allow the optional 'message' property and ensure correct enum and interface types
  const [gameStateSync, setGameStateSync] = useState<{
    score: GameScore;
    turn: CoinType;
    phase: GamePhase;
    timeLeft: number;
    message?: string;
  }>({
    score: { white: 0, black: 0, queenPocketedBy: null, queenCovered: false, winner: null },
    turn: CoinType.WHITE,
    phase: GamePhase.PLACING,
    timeLeft: TURN_TIME_LIMIT,
    message: undefined
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    let channel: BroadcastChannel | null = null;
    if (settings.playMode === PlayMode.ONLINE && settings.roomId) {
        channel = new BroadcastChannel(`carrom_game_${settings.roomId}`);
        channelRef.current = channel;
        channel.onmessage = (ev) => {
             // Pass message to engine
        };
    }

    const engine = new CarromEngine(
        canvasRef.current, 
        settings, 
        (state) => {
            // Fix: setGameStateSync now correctly accepts the state provided by the engine
            setGameStateSync(state);
        },
        (type, payload) => {
            if (channel) channel.postMessage({ type, payload });
        }
    );
    engineRef.current = engine;

    let animationId: number;
    const loop = () => {
      engine.update();
      engine.draw();
      animationId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(animationId);
      if (channel) channel.close();
    };
  }, [settings]);

  const handlePointerDown = (e: React.PointerEvent) => {
    engineRef.current?.handleInput('start', { x: e.clientX, y: e.clientY });
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
    engineRef.current?.handleInput('move', { x: e.clientX, y: e.clientY });
  };
  
  const handlePointerUp = (e: React.PointerEvent) => {
    engineRef.current?.handleInput('end', { x: e.clientX, y: e.clientY });
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-stone-950 overflow-hidden">
      <div className="relative p-2 bg-stone-900 rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-stone-800">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="rounded-[30px] shadow-2xl cursor-crosshair touch-none"
          style={{ maxWidth: '95vmin', maxHeight: '95vmin' }}
        />
      </div>
      
      <UIOverlay 
        score={gameStateSync.score}
        turn={gameStateSync.turn}
        phase={gameStateSync.phase}
        timeLeft={gameStateSync.timeLeft}
        message={gameStateSync.message}
        winner={gameStateSync.score.winner}
        onMenu={onExit}
        onUndoAim={() => engineRef.current?.undoAim()}
      />
    </div>
  );
};

export default GameCanvas;
