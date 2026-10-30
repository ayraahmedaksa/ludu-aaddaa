import express from 'express';
import { protectSupabase } from '../middleware/supabaseAuth.js';
const router = express.Router();
router.get('/me', protectSupabase, (req, res) => res.json({ success:true, user:req.player }));
router.get('/balance', protectSupabase, (req, res) => res.json({ success:true, balance:Number(req.player.balance || 0), hold_balance:Number(req.player.hold_balance || 0) }));
export default router;
