import express from 'express';
import { getRooms, createRoom, joinRoom, getRoomDetails, leaveRoom } from '../controllers/roomController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getRooms);
router.post('/create', protect, createRoom);
router.post('/join/:roomCode', protect, joinRoom);
router.get('/:roomCode', protect, getRoomDetails);
router.post('/leave/:roomCode', protect, leaveRoom);

export default router;
