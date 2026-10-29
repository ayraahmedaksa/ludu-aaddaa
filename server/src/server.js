import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';
import roomRoutes from './routes/room.js';
import chatRoutes from './routes/chat.js';
import { initGameSocket } from './sockets/gameSocket.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5500', 'http://localhost:8080', 'http://127.0.0.1:5500', '*'],
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Ludu Aaddaa Server Running', time: new Date() });
});

app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/chat', chatRoutes);

import pool from './config/db.js';

// Socket.IO for real-time
initGameSocket(io);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-room', (roomCode) => {
    socket.join(roomCode);
    console.log(`Socket ${socket.id} joined room ${roomCode}`);
  });
  
  socket.on('send-message', async (data) => {
    try {
      const blocked = /(01[3-9]\d{8})|(bit\.ly|tinyurl|t\.me)/i;
      if (blocked.test(data.message)) return;
      
      await pool.query('INSERT INTO room_chats (room_id, user_id, message) VALUES ((SELECT id FROM rooms WHERE room_code = ?), ?, ?)', [data.roomCode, data.userId, data.message.trim()]);
      io.to(data.roomCode).emit('receive-message', data);
    } catch (error) {
      console.error('Socket chat error:', error);
    }
  });
  
  socket.on('dice-roll', (data) => {
    io.to(data.roomCode).emit('dice-rolled', data);
  });
  
  socket.on('game-move', (data) => {
    io.to(data.roomCode).emit('game-move', data);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
