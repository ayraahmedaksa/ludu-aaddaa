import express from 'express';
import { protectSupabase } from '../middleware/supabaseAuth.js';
import { listRooms, createRoom, joinRoom } from '../controllers/playerRoomController.js';
const router=express.Router();router.use(protectSupabase);router.get('/',listRooms);router.post('/',createRoom);router.post('/:code/join',joinRoom);export default router;
