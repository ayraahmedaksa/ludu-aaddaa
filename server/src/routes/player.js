import express from 'express';
import { protectSupabase } from '../middleware/supabaseAuth.js';
const router = express.Router();
router.get('/me', protectSupabase, (req, res) => res.json({ success:true, user:req.player }));
router.get('/balance', protectSupabase, (req, res) => res.json({ success:true, balance:Number(req.player.balance || 0), hold_balance:Number(req.player.hold_balance || 0) }));
router.get('/stats', protectSupabase, async (req, res) => {
  const { supabase } = await import('../config/supabase.js');
  const [matches, wins, ledger] = await Promise.all([
    supabase.from('match_players').select('id', { count: 'exact', head: true }).eq('user_id', req.player.id),
    supabase.from('matches').select('id', { count: 'exact', head: true }).eq('winner_id', req.player.id),
    supabase.from('balance_ledger').select('amount').eq('user_id', req.player.id).eq('type', 'win')
  ]);
  const error = [matches, wins, ledger].find(x => x.error)?.error;
  if (error) return res.status(500).json({ success:false, message:error.message });
  res.json({ success:true, matches:matches.count||0, wins:wins.count||0, winnings:(ledger.data||[]).reduce((sum,row)=>sum+Number(row.amount||0),0) });
});
export default router;
