import { supabase, supabaseConfigured } from '../config/supabase.js';

const ready = (res) => {
  if (!supabaseConfigured || !supabase) {
    res.status(503).json({ success: false, message: 'Supabase কনফিগার করা হয়নি।' });
    return false;
  }
  return true;
};

export const dashboard = async (req, res) => {
  if (!ready(res)) return;
  try {
    const [users, deposits, withdrawals, matches] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('deposit_requests').select('id,amount', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('withdraw_requests').select('id,amount', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('matches').select('id', { count: 'exact', head: true }).in('status', ['waiting', 'playing'])
    ]);
    const error = [users, deposits, withdrawals, matches].find((x) => x.error)?.error;
    if (error) throw error;
    res.json({ success: true, stats: {
      totalUsers: users.count || 0,
      pendingDeposits: { count: deposits.count || 0, total: (deposits.data || []).reduce((s, x) => s + Number(x.amount || 0), 0) },
      pendingWithdraws: { count: withdrawals.count || 0, total: (withdrawals.data || []).reduce((s, x) => s + Number(x.amount || 0), 0) },
      activeRooms: matches.count || 0
    }});
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const users = async (req, res) => {
  if (!ready(res)) return;
  const { data, error } = await supabase.from('profiles').select('id,phone,full_name,role,balance,hold_balance,created_at').order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ success: false, message: error.message });
  res.json({ success: true, users: data || [] });
};

export const deposits = async (req, res) => {
  if (!ready(res)) return;
  const { data, error } = await supabase.from('deposit_requests').select('*,profiles(phone,full_name)').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ success: false, message: error.message });
  res.json({ success: true, deposits: data || [] });
};

export const withdrawals = async (req, res) => {
  if (!ready(res)) return;
  const { data, error } = await supabase.from('withdraw_requests').select('*,profiles(phone,full_name)').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ success: false, message: error.message });
  res.json({ success: true, withdrawals: data || [] });
};

export const rooms = async (req, res) => {
  if (!ready(res)) return;
  const { data, error } = await supabase.from('matches').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ success: false, message: error.message });
  res.json({ success: true, rooms: data || [] });
};

export const createTournament = async (req, res) => {
  if (!ready(res)) return;
  const { name, entry_fee, prize_pool, max_players, starts_at } = req.body;
  if (!name || !starts_at) return res.status(400).json({ success: false, message: 'নাম ও সময় আবশ্যক।' });
  const { data, error } = await supabase.from('tournaments').insert({ name, entry_fee: Number(entry_fee || 100), prize_pool: Number(prize_pool || 0), max_players: Number(max_players || 32), starts_at }).select().single();
  if (error) return res.status(500).json({ success: false, message: error.message });
  res.status(201).json({ success: true, tournament: data });
};
