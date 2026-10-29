import { getInitialGameState, rollDice, canMovePawn, movePawn, checkWinner } from '../utils/gameLogic.js';
import { finishGame } from '../controllers/roomController.js';
import pool from '../config/db.js';

const activeGames = new Map();

export const initGameSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);
    
    // গেম রুমে যোগদান
    socket.on('game:join', async ({ roomCode, userId }) => {
      try {
        socket.join(roomCode);
        socket.userId = userId;
        socket.roomCode = roomCode;
        
        // রুম তথ্য চেক
        const [rooms] = await pool.query('SELECT * FROM rooms WHERE room_code = ?', [roomCode]);
        if (rooms.length === 0) return;
        
        const room = rooms[0];
        const players = JSON.parse(room.players || '[]');
        
        // যদি গেম শুরু না হয়ে থাকে এবং ২ জন হয়ে গেছে
        if (room.status === 'playing' && !activeGames.has(roomCode)) {
          const gameState = getInitialGameState(players[0], players[1]);
          activeGames.set(roomCode, gameState);
          
          io.to(roomCode).emit('game:started', {
            gameState,
            players: players,
            currentTurn: players[0]
          });
        } else if (activeGames.has(roomCode)) {
          const gameState = activeGames.get(roomCode);
          io.to(socket.id).emit('game:state', { gameState });
        }
      } catch (error) {
        console.error('Game join error:', error);
      }
    });
    
    // ডাইস রোল
    socket.on('game:rollDice', ({ roomCode, userId }) => {
      const gameState = activeGames.get(roomCode);
      if (!gameState) return;
      
      if (gameState.currentTurn !== userId) {
        socket.emit('game:error', { message: 'আপনার পালা নয়!' });
        return;
      }
      
      if (gameState.hasRolled) {
        socket.emit('game:error', { message: 'আপনি ইতিমধ্যে ডাইস রোল করেছেন!' });
        return;
      }
      
      const diceValue = rollDice();
      gameState.diceValue = diceValue;
      gameState.hasRolled = true;
      gameState.lastRoll = diceValue;
      
      // বৈধ চাল আছে কিনা চেক
      const player = gameState.players[userId];
      let hasValidMove = false;
      
      if (diceValue === 6) {
        // হোমে আছে কিনা অথবা মাঠে আছে কিনা চেক
        hasValidMove = player.pawns.some(p => p.position === 'home' || p.position === 'board');
      } else {
        hasValidMove = player.pawns.some(p => p.position === 'board');
      }
      
      if (!hasValidMove && diceValue !== 6) {
        // কোনো চাল না থাকলে পালা পরিবর্তন
        const players = Object.keys(gameState.players);
        const currentIndex = players.indexOf(userId);
        gameState.currentTurn = players[(currentIndex + 1) % players.length];
        gameState.hasRolled = false;
        gameState.diceValue = null;
        
        io.to(roomCode).emit('game:turnChange', {
          currentTurn: gameState.currentTurn,
          message: 'কোনো বৈধ চাল নেই, পালা পরিবর্তন'
        });
        return;
      }
      
      io.to(roomCode).emit('game:diceRolled', {
        userId,
        diceValue,
        gameState
      });
    });
    
    // গুটি চালনা
    socket.on('game:movePawn', ({ roomCode, userId, pawnIndex }) => {
      const gameState = activeGames.get(roomCode);
      if (!gameState) return;
      
      if (gameState.currentTurn !== userId) {
        socket.emit('game:error', { message: 'আপনার পালা নয়!' });
        return;
      }
      
      if (!gameState.hasRolled || !gameState.diceValue) {
        socket.emit('game:error', { message: 'প্রথমে ডাইস রোল করুন!' });
        return;
      }
      
      if (!canMovePawn(gameState, userId, pawnIndex, gameState.diceValue)) {
        socket.emit('game:error', { message: 'এই গুটি চালানো সম্ভব নয়!' });
        return;
      }
      
      const result = movePawn(gameState, userId, pawnIndex, gameState.diceValue);
      
      if (result.success) {
        // জয় চেক
        if (checkWinner(gameState, userId)) {
          gameState.winner = userId;
          activeGames.delete(roomCode);
          
          // অটোমেটিক টাকা প্রদান
          finishGame(roomCode, userId).then(() => {
            io.to(roomCode).emit('game:over', {
              winner: userId,
              message: 'খেলোয়াড় জয়ী হয়েছে!'
            });
          });
          return;
        }
        
        // পালা পরিবর্তন (যদি ৬ না আসে)
        if (gameState.diceValue !== 6) {
          const players = Object.keys(gameState.players);
          const currentIndex = players.indexOf(userId);
          gameState.currentTurn = players[(currentIndex + 1) % players.length];
          gameState.turnCount++;
        }
        
        gameState.hasRolled = false;
        gameState.diceValue = null;
        
        io.to(roomCode).emit('game:pawnMoved', {
          userId,
          pawnIndex,
          diceValue: gameState.lastRoll,
          gameState,
          nextTurn: gameState.currentTurn
        });
      }
    });
    
    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });
};
