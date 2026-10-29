import pool from '../config/db.js';

export const getSettings = async (req, res) => {
  try {
    const [settings] = await pool.query('SELECT `key`, `value` FROM settings');
    const config = {};
    settings.forEach(s => {
      try {
        config[s.key] = JSON.parse(s.value);
      } catch {
        config[s.key] = s.value;
      }
    });
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const createDeposit = async (req, res) => {
  try {
    const { amount, method, sender_number, trx_id } = req.body;
    const userId = req.user.id;

    const [settings] = await pool.query('SELECT `value` FROM settings WHERE `key` = "min_deposit"');
    const minDeposit = Number(settings[0]?.value || 500);

    if (!amount || amount < minDeposit) {
      return res.status(400).json({ success: false, message: `সর্বনিম্ন রিচার্জ ${minDeposit} টাকা।` });
    }

    if (!['bkash', 'nagad', 'rocket'].includes(method)) {
      return res.status(400).json({ success: false, message: 'সঠিক পদ্ধতি নির্বাচন করুন।' });
    }

    if (!sender_number || !trx_id) {
      return res.status(400).json({ success: false, message: 'সেন্ডার নম্বর ও TrxID প্রয়োজন।' });
    }

    // Check duplicate trx
    const [existing] = await pool.query('SELECT id FROM deposit_requests WHERE trx_id = ?', [trx_id]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'এই TrxID ইতিমধ্যে ব্যবহার করা হয়েছে।' });
    }

    const [config] = await pool.query('SELECT `value` FROM settings WHERE `key` = "deposit_numbers"');
    const numbers = JSON.parse(config[0]?.value || '{}');
    const receiver_number = numbers[method]?.[0] || '';

    const [result] = await pool.query(
      'INSERT INTO deposit_requests (user_id, amount, method, sender_number, receiver_number, trx_id) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, amount, method, sender_number, receiver_number, trx_id]
    );

    res.status(201).json({ success: true, message: 'ডিপোজিট রিকোয়েস্ট জমা হয়েছে। অপেক্ষা করুন।', requestId: result.insertId });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const getMyDeposits = async (req, res) => {
  try {
    const [deposits] = await pool.query(
      'SELECT id, amount, method, trx_id, status, note, created_at, approved_at, rejected_at FROM deposit_requests WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, deposits });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};
