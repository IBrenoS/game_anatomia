import React from 'react';
import { PublicQuestion } from '@batalha/protocol';
import { wsManager } from '../../lib/ws.js';
import { useGameStore } from '../../stores/gameStore.js';

interface HostControlsProps {
  roomState: string | null;
}

export default function HostControls({ roomState }: HostControlsProps) {
  const handleCommand = (command: string) => {
    wsManager.sendHostCommand(command as any, wsManager.roomVersion);
  };

  const renderButtons = () => {
    switch (roomState) {
      case 'LOBBY':
        return (
          <button 
            onClick={() => handleCommand('START_GAME')}
            className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg shadow transition-colors"
          >
            Start Game
          </button>
        );
      case 'QUESTION_ACTIVE':
        return (
          <button 
            onClick={() => handleCommand('SKIP_QUESTION')}
            className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg shadow transition-colors"
          >
            Skip/Reveal Early
          </button>
        );
      case 'QUESTION_REVEAL':
      case 'ROUND_RANKING':
        return (
          <button 
            onClick={() => handleCommand('NEXT_STEP')}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg shadow transition-colors"
          >
            Next
          </button>
        );
      case 'FINAL_RANKING':
        return (
          <button 
            onClick={() => handleCommand('NEXT_STEP')}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-lg shadow transition-colors"
          >
            Show Podium
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex justify-end gap-4">
      {renderButtons()}
    </div>
  );
}
