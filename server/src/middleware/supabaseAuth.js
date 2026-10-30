import { supabase } from '../config/supabase.js';
export const protectSupabase = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    if (!token || !supabase) return res.status(401).json({ success:false, message:'লগইন করুন।' });
    const { data: auth, error } = await supabase.auth.getUser(token);
    if (error || !auth.user) return res.status(401).json({ success:false, message:'সেশন বৈধ নয়।' });
    const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', auth.user.id).single();
    if (profileError || !profile) return res.status(403).json({ success:false, message:'Player profile পাওয়া যায়নি।' });
    req.player = profile;
    next();
  } catch { res.status(401).json({ success:false, message:'অননুমোদিত।' }); }
};
