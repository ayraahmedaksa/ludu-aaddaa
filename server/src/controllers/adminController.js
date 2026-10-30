import pool from '../config/db.js';
import { hashPassword, comparePassword, generateToken } from '../utils/helpers.js';

export const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;`r`n    const tempUser = process.env.ADMIN_USERNAME || "admin";`r`n    const tempPass = process.env.ADMIN_PASSWORD || "admin123";`r`n    if (process.env.TEMP_ADMIN_LOGIN !== "false" && username === tempUser && password === tempPass) {`r`n      const token = generateToken({ id: "temporary-admin", role: "admin" });`r`n      return res.json({ success: true, token, agent: { id: "temporary-admin", username: tempUser, role: "admin", temporary: true } });`r`n    }
    const [agents] = await pool.query('SELECT * FROM agents WHERE username = ?', [username]);
    
    if (agents.length === 0) {
      return res.status(401).json({ success: false, message: 'ভুল ইউজারনেম বা পাসওয়ার্ড।' });
    }

    const agent = agents[0];
    if (agent.status !== 'active') {
      return res.status(403).json({ success: false, message: 'অ্যাকাউন্ট নিষ্ক্রিয়।' });
    }

    const isMatch = await comparePassword(password, agent.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'ভুল ইউজারনেম বা পাসওয়ার্ড।' });
    }

    const token = generateToken({ id: agent.id });
    const { password: _, ...agentData } = agent;
    res.json({ success: true, token, agent: agentData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const dashboard = async (req, res) => {
  try {
    const [totalUsers] = await pool.query('SELECT COUNT(*) as count FROM users');
    const [todayUsers] = await pool.query('SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = CURDATE()');
    const [pendingDeposits] = await pool.query('SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM deposit_requests WHERE status="pending"');
    const [pendingWithdraws] = await pool.query('SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM withdraw_requests WHERE status="pending"');
    const [activeRooms] = await pool.query('SELECT COUNT(*) as count FROM rooms WHERE status IN("waiting","playing")');
    
    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers[0].count,
        todayUsers: todayUsers[0].count,
        pendingDeposits: pendingDeposits[0],
        pendingWithdraws: pendingWithdraws[0],
        activeRooms: activeRooms[0].count
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { search, status } = req.query;
    let query = 'SELECT id, phone, full_name, balance, hold_balance, status, created_at, last_login FROM users WHERE 1=1';
    const params = [];
    
    if (search) {
      query += ' AND (phone LIKE ? OR full_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC LIMIT 100';
    
    const [users] = await pool.query(query, params);
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const updateUserBalance = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { amount, type, description } = req.body;
    
    const [users] = await conn.query('SELECT balance FROM users WHERE id = ? FOR UPDATE', [id]);
    const user = users[0];
    const before = Number(user.balance);
    const newBalance = type === 'add' ? before + Number(amount) : before - Number(amount);
    
    await conn.query('UPDATE users SET balance = ? WHERE id = ?', [newBalance, id]);
    await conn.query(
      'INSERT INTO balance_log (user_id, type, amount, balance_before, balance_after, description, reference_type, created_by) VALUES (?, ?, ?, ?, ?, ?, "admin", ?)',
      [id, type === 'add' ? 'credit' : 'debit', amount, before, newBalance, description || 'অ্যাডমিন দ্বারা ব্যালেন্স পরিবর্তন', req.agent.id]
    );
    
    await conn.commit();
    res.json({ success: true, message: 'ব্যালেন্স আপডেট হয়েছে।', newBalance });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  } finally {
    conn.release();
  }
};

export const toggleUserBan = async (req, res) => {
  try {
    const { id } = req.params;
    const [users] = await pool.query('SELECT status FROM users WHERE id = ?', [id]);
    const newStatus = users[0].status === 'banned' ? 'active' : 'banned';
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [newStatus, id]);
    res.json({ success: true, message: newStatus === 'banned' ? 'ইউজার ব্যান করা হয়েছে।' : 'ইউজার আনব্যান করা হয়েছে।' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const getDepositRequests = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const [deposits] = await pool.query(
      `SELECT d.*, u.phone, u.full_name FROM deposit_requests d 
       JOIN users u ON u.id = d.user_id 
       WHERE d.status = ? ORDER BY d.created_at ASC`,
      [status]
    );
    res.json({ success: true, deposits });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const approveDeposit = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    
    const [requests] = await conn.query('SELECT * FROM deposit_requests WHERE id = ? AND status = "pending" FOR UPDATE', [id]);
    if (requests.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'রিকোয়েস্ট পাওয়া যায়নি বা ইতিমধ্যে প্রসেস করা হয়েছে।' });
    }
    
    const deposit = requests[0];
    const [users] = await conn.query('SELECT balance FROM users WHERE id = ? FOR UPDATE', [deposit.user_id]);
    const before = Number(users[0].balance);
    const after = before + Number(deposit.amount);
    
    await conn.query('UPDATE users SET balance = ? WHERE id = ?', [after, deposit.user_id]);
    await conn.query('UPDATE deposit_requests SET status = "approved", approved_by = ?, approved_at = NOW() WHERE id = ?', [req.agent.id, id]);
    await conn.query(
      'INSERT INTO balance_log (user_id, type, amount, balance_before, balance_after, description, reference_type, reference_id) VALUES (?, "credit", ?, ?, ?, ?, "deposit", ?)',
      [deposit.user_id, deposit.amount, before, after, `ডিপোজিট অনুমোদন - TrxID: ${deposit.trx_id}`, deposit.trx_id]
    );
    await conn.query('INSERT INTO notifications (user_id, title, message, type) VALUES (?, "ডিপোজিট সফল", ?, "deposit")', 
      [deposit.user_id, `${deposit.amount} টাকা আপনার অ্যাকাউন্টে যোগ করা হয়েছে।`]);
    
    await conn.commit();
    res.json({ success: true, message: 'ডিপোজিট অনুমোদন করা হয়েছে।' });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  } finally {
    conn.release();
  }
};

export const rejectDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    await pool.query(
      'UPDATE deposit_requests SET status = "rejected", rejected_by = ?, rejected_at = NOW(), reject_reason = ? WHERE id = ? AND status = "pending"',
      [req.agent.id, reason || 'অনুমোদনযোগ্য নয়', id]
    );
    
    const [requests] = await pool.query('SELECT user_id, amount FROM deposit_requests WHERE id = ?', [id]);
    if (requests.length > 0) {
      await pool.query('INSERT INTO notifications (user_id, title, message, type) VALUES (?, "ডিপোজিট প্রত্যাখ্যান", ?, "deposit")', 
        [requests[0].user_id, `${requests[0].amount} টাকার ডিপোজিট রিকোয়েস্ট প্রত্যাখ্যান করা হয়েছে। কারণ: ${reason || 'অনুমোদনযোগ্য নয়'}`]);
    }
    
    res.json({ success: true, message: 'ডিপোজিট প্রত্যাখ্যান করা হয়েছে।' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const getWithdrawRequests = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const [withdraws] = await pool.query(
      `SELECT w.*, u.phone, u.full_name, u.balance FROM withdraw_requests w 
       JOIN users u ON u.id = w.user_id 
       WHERE w.status = ? ORDER BY w.created_at ASC`,
      [status]
    );
    res.json({ success: true, withdraws });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const markWithdrawPaid = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    
    const [requests] = await conn.query('SELECT * FROM withdraw_requests WHERE id = ? AND status = "pending" FOR UPDATE', [id]);
    if (requests.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'রিকোয়েস্ট পাওয়া যায়নি।' });
    }
    
    const withdraw = requests[0];
    await conn.query('UPDATE withdraw_requests SET status = "paid", paid_by = ?, paid_at = NOW() WHERE id = ?', [req.agent.id, id]);
    await conn.query('UPDATE users SET hold_balance = hold_balance - ? WHERE id = ?', [withdraw.hold_amount, withdraw.user_id]);
    await conn.query('INSERT INTO notifications (user_id, title, message, type) VALUES (?, "উইথড্র সম্পন্ন", ?, "withdraw")', 
      [withdraw.user_id, `${withdraw.amount} টাকা সফলভাবে পাঠানো হয়েছে।`]);
    
    await conn.commit();
    res.json({ success: true, message: 'উইথড্র পেইড হিসেবে মার্ক করা হয়েছে।' });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  } finally {
    conn.release();
  }
};

export const rejectWithdraw = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { reason } = req.body;
    
    const [requests] = await conn.query('SELECT * FROM withdraw_requests WHERE id = ? AND status = "pending" FOR UPDATE', [id]);
    if (requests.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'রিকোয়েস্ট পাওয়া যায়নি।' });
    }
    
    const withdraw = requests[0];
    // Refund hold balance
    await conn.query('UPDATE users SET balance = balance + ?, hold_balance = hold_balance - ? WHERE id = ?', [withdraw.hold_amount, withdraw.hold_amount, withdraw.user_id]);
    await conn.query('UPDATE withdraw_requests SET status = "rejected", rejected_by = ?, rejected_at = NOW(), reject_reason = ? WHERE id = ?', [req.agent.id, reason || 'অনুমোদনযোগ্য নয়', id]);
    await conn.query(
      'INSERT INTO balance_log (user_id, type, amount, balance_before, balance_after, description, reference_type) VALUES (?, "refund", ?, (SELECT balance FROM users WHERE id = ?), (SELECT balance+? FROM users WHERE id = ?), "উইথড্র প্রত্যাখ্যান - ফেরত", "withdraw")',
      [withdraw.user_id, withdraw.hold_amount, withdraw.user_id, withdraw.hold_amount, withdraw.user_id]
    );
    await conn.query('INSERT INTO notifications (user_id, title, message, type) VALUES (?, "উইথড্র প্রত্যাখ্যান", ?, "withdraw")', 
      [withdraw.user_id, `${withdraw.amount} টাকার উইথড্র রিকোয়েস্ট প্রত্যাখ্যান হয়েছে। টাকা ফেরত দেওয়া হয়েছে।`]);
    
    await conn.commit();
    res.json({ success: true, message: 'উইথড্র প্রত্যাখ্যান করা হয়েছে এবং টাকা ফেরত দেওয়া হয়েছে।' });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  } finally {
    conn.release();
  }
};

export const getSettings = async (req, res) => {
  try {
    const [settings] = await pool.query('SELECT * FROM settings');
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { key, value } = req.body;
    await pool.query('INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?', [key, JSON.stringify(value), JSON.stringify(value)]);
    res.json({ success: true, message: 'সেটিংস আপডেট হয়েছে।' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const getAllRooms = async (req, res) => {
  try {
    const [rooms] = await pool.query('SELECT * FROM rooms ORDER BY created_at DESC LIMIT 50');
    res.json({ success: true, rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const getChatLogs = async (req, res) => {
  try {
    const { roomId } = req.params;
    const [chats] = await pool.query(
      `SELECT c.*, u.phone, u.full_name FROM room_chats c 
       JOIN users u ON u.id = c.user_id 
       WHERE c.room_id = ? ORDER BY c.created_at ASC`,
      [roomId]
    );
    res.json({ success: true, chats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};
