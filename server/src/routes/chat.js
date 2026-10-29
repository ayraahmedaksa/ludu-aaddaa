import express from 'express';
import pool from '../config/db.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/:roomId', protect, async (req, res) => {
  try {
    const { roomId } = req.params;
    const [chats] = await pool.query(
      `SELECT c.*, u.phone, u.full_name FROM room_chats c 
       JOIN users u ON u.id = c.user_id 
       WHERE c.room_id = ? ORDER BY c.created_at ASC LIMIT 100`,
      [roomId]
    );
    res.json({ success: true, chats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
});

router.post('/:roomId', protect, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'বার্তা লিখুন।' });
    }
    
    // Basic filter
    const blocked = /(01[3-9]\d{8})|(bit\.ly|tinyurl|t\.me)/i;
    if (blocked.test(message)) {
      return res.status(400).json({ success: false, message: 'ফোন নম্বর, লিংক অনুমোদিত নয়।' });
    }
    
    await pool.query('INSERT INTO room_chats (room_id, user_id, message) VALUES (?, ?, ?)', [roomId, userId, message.trim()]);
    res.json({ success: true, message: 'বার্তা পাঠানো হয়েছে।' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
});

export default router;
