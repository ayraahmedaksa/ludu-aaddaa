import pool from '../config/db.js';

export const createWithdraw = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const { amount, method, account_number } = req.body;
    const userId = req.user.id;

    const [settings] = await conn.query('SELECT `value` FROM settings WHERE `key` = "min_withdraw"');
    const minWithdraw = Number(settings[0]?.value || 2000);

    if (!amount || amount < minWithdraw) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `সর্বনিম্ন উত্তোলন ${minWithdraw} টাকা।` });
    }

    if (!['bkash', 'nagad', 'rocket'].includes(method)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'সঠিক পদ্ধতি নির্বাচন করুন।' });
    }

    if (!account_number) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'অ্যাকাউন্ট নম্বর প্রয়োজন।' });
    }

    const [users] = await conn.query('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    const user = users[0];

    if (Number(user.balance) < Number(amount)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'পর্যাপ্ত ব্যালেন্স নেই।' });
    }

    // Check pending withdraw
    const [pending] = await conn.query('SELECT id FROM withdraw_requests WHERE user_id = ? AND status = "pending"', [userId]);
    if (pending.length > 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'আপনার ইতিমধ্যে একটি উত্তোলন রিকোয়েস্ট রয়েছে।' });
    }

    // Hold balance
    await conn.query('UPDATE users SET balance = balance - ?, hold_balance = hold_balance + ? WHERE id = ?', [amount, amount, userId]);
    
    await conn.query(
      'INSERT INTO withdraw_requests (user_id, amount, method, account_number, hold_amount) VALUES (?, ?, ?, ?, ?)',
      [userId, amount, method, account_number, amount]
    );

    await conn.query(
      'INSERT INTO balance_log (user_id, type, amount, balance_before, balance_after, description, reference_type) VALUES (?, "debit", ?, ?, ?, "উইথড্র রিকোয়েস্ট - হোল্ড", "withdraw")',
      [userId, amount, user.balance, Number(user.balance) - Number(amount)]
    );

    await conn.commit();
    res.status(201).json({ success: true, message: 'উইথড্র রিকোয়েস্ট জমা হয়েছে।' });
  } catch (error) {
    await conn.rollback();
    console.error('Withdraw error:', error);
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  } finally {
    conn.release();
  }
};

export const getMyWithdraws = async (req, res) => {
  try {
    const [withdraws] = await pool.query(
      'SELECT id, amount, method, account_number, status, note, reject_reason, created_at, paid_at, rejected_at FROM withdraw_requests WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, withdraws });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};
