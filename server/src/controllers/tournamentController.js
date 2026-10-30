import { supabase, supabaseConfigured } from '../config/supabase.js';
import { createClient } from '@supabase/supabase-js';
export const listTournaments = async (req, res) => {
  if (!supabaseConfigured || !supabase) return res.status(503).json({ success: false, message: 'Supabase কনফিগার করা হয়নি।' });
  const { data, error } = await supabase.from('tournaments').select('id,name,entry_fee,prize_pool,max_players,starts_at,status').eq('status','scheduled').order('starts_at',{ascending:true});
  if (error) return res.status(500).json({ success:false, message:error.message });
  res.json({ success:true, tournaments:data || [] });
};

export const joinTournament = async (req, res) => {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token || !supabaseConfigured || !supabase) return res.status(401).json({ success:false, message:'লগইন করুন।' });
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, { global:{ headers:{ Authorization:`Bearer ${token}` } }, auth:{ persistSession:false, autoRefreshToken:false } });
  const { data, error } = await client.rpc('join_tournament', { p_tournament: req.params.id });
  if (error) return res.status(400).json({ success:false, message:error.message });
  res.json({ success:true, ...data });
};
