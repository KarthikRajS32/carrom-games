
import React from 'react';
import { GamePhase, GameScore, CoinType } from '../types';
import { TURN_TIME_LIMIT } from '../constants';

interface UIOverlayProps {
  score: GameScore;
  turn: CoinType;
  phase: GamePhase;
  timeLeft: number;
  message?: string;
  onMenu: () => void;
  onUndoAim: () => void;
  winner: string | null;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ score, turn, phase, timeLeft, message, onMenu, onUndoAim, winner }) => {
  const timePercent = Math.max(0, (timeLeft / TURN_TIME_LIMIT) * 100);
  const isLowTime = timeLeft < 5;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between font-sans">
      {/* Top HUD: Scores and Timer */}
      <div className="w-full p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/60 to-transparent">
        <button 
          onClick={onMenu} 
          className="bg-stone-900/90 backdrop-blur text-amber-500 px-4 py-2 rounded-lg border border-stone-700 pointer-events-auto font-bold text-xs hover:bg-amber-500 hover:text-stone-950 transition-all uppercase tracking-tighter"
        >
          Menu
        </button>
        
        <div className="flex items-center gap-6">
          {/* White Player Score */}
          <div className={`flex items-center gap-3 transition-all duration-500 ${turn === CoinType.WHITE ? 'scale-110' : 'opacity-40 grayscale'}`}>
            <div className="text-right">
              <div className="text-[10px] text-amber-400/70 uppercase font-black tracking-widest leading-none mb-1">White</div>
              <div className="text-3xl font-black text-white leading-none">{score.white}</div>
            </div>
            <div className={`w-10 h-10 rounded-full bg-stone-100 border-2 shadow-xl ${turn === CoinType.WHITE ? 'border-amber-400 ring-4 ring-amber-400/20' : 'border-stone-500'}`} />
          </div>

          {/* Central Timer Display */}
          <div className="flex flex-col items-center gap-1 w-32">
             <div className="text-[9px] text-stone-400 uppercase font-bold tracking-[0.2em]">Turn Timer</div>
             <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden border border-stone-700/50">
               <div 
                 className={`h-full transition-all duration-300 ${isLowTime ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`}
                 style={{ width: `${timePercent}%` }}
               />
             </div>
          </div>

          {/* Black Player Score */}
          <div className={`flex items-center gap-3 transition-all duration-500 ${turn === CoinType.BLACK ? 'scale-110' : 'opacity-40 grayscale'}`}>
            <div className={`w-10 h-10 rounded-full bg-stone-800 border-2 shadow-xl ${turn === CoinType.BLACK ? 'border-amber-400 ring-4 ring-amber-400/20' : 'border-stone-500'}`} />
            <div className="text-left">
              <div className="text-[10px] text-amber-400/70 uppercase font-black tracking-widest leading-none mb-1">Black</div>
              <div className="text-3xl font-black text-white leading-none">{score.black}</div>
            </div>
          </div>
        </div>

        <div className="w-12" /> {/* Spacer */}
      </div>

      {/* Top Banner Message (Moved away from center) */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pointer-events-none z-30">
        {message && (
          <div className="bg-amber-500 text-stone-950 text-center py-2 px-6 rounded-full font-black text-lg uppercase tracking-tight shadow-[0_4px_20px_rgba(245,158,11,0.4)] animate-fade-in-down border-2 border-stone-900/20">
            {message}
          </div>
        )}
      </div>

      {/* Bottom HUD: Instructions and Controls */}
      <div className="w-full p-6 flex items-end justify-between z-20 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
        
        {/* Helper text shifted to bottom-left */}
        <div className="flex flex-col gap-1 max-w-[200px]">
           <span className="text-amber-500/50 text-[10px] font-bold uppercase tracking-widest">Status</span>
           <div className="text-white text-sm font-medium uppercase tracking-tighter">
             {phase === GamePhase.PLACING && "Position your striker"}
             {phase === GamePhase.AIMING && "Aim and pull back"}
             {phase === GamePhase.SHOOTING && "Strike in progress..."}
             {phase === GamePhase.SETTLING && "Waiting for finish..."}
           </div>
        </div>

        {/* Action Button moved to bottom-right */}
        <div className="pointer-events-auto">
          {phase === GamePhase.AIMING && !winner && (
            <button 
              onClick={onUndoAim}
              className="bg-stone-900/95 text-amber-500 px-6 py-3 rounded-xl border border-amber-500/30 font-black text-sm hover:bg-amber-500 hover:text-stone-950 transition-all uppercase tracking-widest shadow-2xl active:scale-95"
            >
              Reset Position
            </button>
          )}
        </div>
      </div>

      {/* Winner Modal */}
      {winner && (
        <div className="absolute inset-0 bg-stone-950/90 flex items-center justify-center pointer-events-auto z-50 backdrop-blur-md">
           <div className="bg-stone-900 p-12 rounded-3xl border-4 border-amber-500 text-center shadow-[0_0_50px_rgba(251,191,36,0.3)] animate-fade-in max-w-sm w-full">
              <div className="text-amber-500 text-sm font-bold uppercase tracking-[0.3em] mb-2">Victory</div>
              <h2 className="text-5xl font-black text-white mb-6 italic tracking-tighter">{winner.toUpperCase()}</h2>
              <div className="bg-stone-800 p-6 rounded-2xl mb-8 space-y-3">
                 <div className="flex justify-between text-stone-400 font-bold text-xs uppercase">
                    <span>Final Score</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-white font-medium">White Team</span>
                    <span className="text-2xl font-black text-amber-400">{score.white}</span>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-white font-medium">Black Team</span>
                    <span className="text-2xl font-black text-amber-400">{score.black}</span>
                 </div>
              </div>
              <button 
                onClick={onMenu}
                className="bg-amber-500 hover:bg-amber-400 text-stone-900 px-12 py-4 rounded-xl font-black w-full transition-all shadow-lg text-lg uppercase tracking-tight"
              >
                Return to Menu
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default UIOverlay;
