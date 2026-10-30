import { supabase, supabaseConfigured } from '../config/supabase.js';

const emailFor = (phone) => `${String(phone).replace(/\D/g, '')}@players.ludu-aaddaa.local`;

export const signup = async (req, res) => {
  if (!supabaseConfigured || !supabase) return res.status(503).json({ success:false, message:'Supabase কনফিগার করা হয়নি।' });
  const { name, phone, password, confirmPassword } = req.body;
  const normalized = String(phone || '').replace(/\D/g, '');
  if (!name || normalized.length < 10 || !password || password !== confirmPassword) return res.status(400).json({ success:false, message:'সব তথ্য সঠিকভাবে দিন।' });
  if (password.length < 6) return res.status(400).json({ success:false, message:'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
  const created = await supabase.auth.admin.createUser({ email: emailFor(normalized), password, email_confirm: true, user_metadata: { name, phone: normalized } });
  if (created.error) return res.status(400).json({ success:false, message: created.error.message });
  const { data: profile, error } = await supabase.from('profiles').insert({ id: created.data.user.id, phone: normalized, full_name: name }).select().single();
  if (error) return res.status(500).json({ success:false, message:error.message });
  const session = await supabase.auth.signInWithPassword({ email: emailFor(normalized), password });
  res.status(201).json({ success:true, token: session.data?.session?.access_token, user: profile });
};

export const login = async (req, res) => {
  if (!supabaseConfigured || !supabase) return res.status(503).json({ success:false, message:'Supabase কনফিগার করা হয়নি।' });
  const phone = String(req.body.phone || '').replace(/\D/g, '');
  const { data, error } = await supabase.auth.signInWithPassword({ email: emailFor(phone), password: req.body.password || '' });
  if (error) return res.status(401).json({ success:false, message:'ফোন নম্বর বা পাসওয়ার্ড সঠিক নয়।' });
  res.json({ success:true, token:data.session.access_token, user:data.user });
};
