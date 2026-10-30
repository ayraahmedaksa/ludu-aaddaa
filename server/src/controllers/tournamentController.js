import { supabase, supabaseConfigured } from '../config/supabase.js';
export const listTournaments = async (req, res) => {
  if (!supabaseConfigured || !supabase) return res.status(503).json({ success: false, message: 'Supabase কনফিগার করা হয়নি।' });
  const { data, error } = await supabase.from('tournaments').select('id,name,entry_fee,prize_pool,max_players,starts_at,status').eq('status','scheduled').order('starts_at',{ascending:true});
  if (error) return res.status(500).json({ success:false, message:error.message });
  res.json({ success:true, tournaments:data || [] });
};
