// লুডু গেম লজিক

// প্রধান পথ (clockwise)
export const MAIN_PATH = [
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0]
];

// হোম lane
export const HOME_LANE = {
  blue: [[6,1],[6,2],[6,3],[6,4],[6,5]], // প্লেয়ার (blue)
  green: [[1,6],[2,6],[3,6],[4,6],[5,6]] // কম্পিউটার/অপোনেন্ট (green)
};

// স্টার্টিং পজিশন
export const START_POS = {
  blue: { row: 6, col: 1 },
  green: { row: 1, col: 6 }
};

// রঙ অনুযায়ী স্টার্ট ইন্ডেক্স
export const START_INDEX = {
  blue: 0,
  green: 13
};

export const generateRoomId = () => {
  return Math.random().toString(36).substr(2, 9).toUpperCase();
};

export const rollDice = () => {
  return Math.floor(Math.random() * 6) + 1;
};

export const getInitialGameState = (player1Id, player2Id) => {
  return {
    players: {
      [player1Id]: {
        id: player1Id,
        color: 'blue',
        pawns: [
          { id: 0, position: 'home', step: -1, safe: true },
          { id: 1, position: 'home', step: -1, safe: true },
          { id: 2, position: 'home', step: -1, safe: true },
          { id: 3, position: 'home', step: -1, safe: true }
        ]
      },
      [player2Id]: {
        id: player2Id,
        color: 'green',
        pawns: [
          { id: 0, position: 'home', step: -1, safe: true },
          { id: 1, position: 'home', step: -1, safe: true },
          { id: 2, position: 'home', step: -1, safe: true },
          { id: 3, position: 'home', step: -1, safe: true }
        ]
      }
    },
    currentTurn: player1Id,
    diceValue: null,
    hasRolled: false,
    movesLeft: 0,
    lastRoll: null,
    winner: null,
    turnCount: 0,
    createdAt: new Date().toISOString()
  };
};

export const canMovePawn = (gameState, playerId, pawnIndex, diceValue) => {
  const player = gameState.players[playerId];
  if (!player) return false;
  
  const pawn = player.pawns[pawnIndex];
  if (!pawn) return false;
  
  // যদি হোমে থাকে এবং ডাইস ৬ না হয়
  if (pawn.position === 'home' && diceValue !== 6) {
    return false;
  }
  
  // যদি হোমে থাকে এবং ডাইস ৬ হয় - স্টার্টে যেতে পারবে
  if (pawn.position === 'home' && diceValue === 6) {
    return true;
  }
  
  // যদি মাঠে থাকে
  if (pawn.position === 'board') {
    const newStep = pawn.step + diceValue;
    // ৫৭ ঘর শেষ
    if (newStep > 56) return false;
    if (newStep === 56) return true; // হোমে যাবে
    if (newStep < 56) return true;
  }
  
  return false;
};

export const movePawn = (gameState, playerId, pawnIndex, diceValue) => {
  const player = gameState.players[playerId];
  const pawn = player.pawns[pawnIndex];
  const color = player.color;
  
  if (pawn.position === 'home' && diceValue === 6) {
    // স্টার্টে নিয়ে যাওয়া
    pawn.position = 'board';
    pawn.step = START_INDEX[color];
    return { success: true, pawn, captured: null };
  }
  
  if (pawn.position === 'board') {
    const oldStep = pawn.step;
    const newStep = oldStep + diceValue;
    
    if (newStep === 56) {
      // হোমে পৌঁছেছে
      pawn.position = 'finished';
      pawn.step = 56;
      return { success: true, pawn, captured: null, finished: true };
    }
    
    if (newStep > 56) {
      return { success: false };
    }
    
    pawn.step = newStep;
    return { success: true, pawn, captured: null };
  }
  
  return { success: false };
};

export const checkWinner = (gameState, playerId) => {
  const player = gameState.players[playerId];
  if (!player) return false;
  
  const allFinished = player.pawns.every(p => p.position === 'finished');
  return allFinished;
};
