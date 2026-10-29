import pool from '../config/db.js';
import { hashPassword, comparePassword, generateToken, generateReferralCode } from '../utils/helpers.js';

export const register = async (req, res) => {
  try {
    const { phone, password, full_name, referral_code } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'মোবাইল নম্বর ও পাসওয়ার্ড প্রয়োজন।' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'এই মোবাইল নম্বর ইতিমধ্যে নিবন্ধিত।' });
    }

    const hashedPassword = await hashPassword(password);
    const userReferralCode = generateReferralCode(phone);
    
    let referred_by = null;
    if (referral_code) {
      const [referrer] = await pool.query('SELECT id FROM users WHERE referral_code = ?', [referral_code]);
      if (referrer.length > 0) referred_by = referrer[0].id;
    }

    const ip = req.ip || req.connection.remoteAddress;
    const [result] = await pool.query(
      'INSERT INTO users (phone, password, full_name, referral_code, referred_by, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [phone, hashedPassword, full_name || null, userReferralCode, referred_by, ip]
    );

    const [users] = await pool.query('SELECT id, phone, full_name, balance, referral_code FROM users WHERE id = ?', [result.insertId]);
    const token = generateToken(users[0]);

    res.status(201).json({ success: true, message: 'রেজিস্ট্রেশন সফল হয়েছে।', token, user: users[0] });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'মোবাইল নম্বর ও পাসওয়ার্ড প্রয়োজন।' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE phone = ?', [phone]);
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'মোবাইল নম্বর বা পাসওয়ার্ড ভুল।' });
    }

    const user = users[0];
    if (user.status === 'banned') {
      return res.status(403).json({ success: false, message: 'আপনার অ্যাকাউন্ট ব্যান করা হয়েছে।' });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'মোবাইল নম্বর বা পাসওয়ার্ড ভুল।' });
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = generateToken(user);
    const { password: _, ...userData } = user;

    res.json({ success: true, message: 'লগইন সফল হয়েছে।', token, user: userData });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const me = async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, phone, full_name, balance, hold_balance, referral_code, status FROM users WHERE id = ?', [req.user.id]);
    res.json({ success: true, user: users[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};
