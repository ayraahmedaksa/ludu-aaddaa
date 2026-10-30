import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'অননুমোদিত। লগইন করুন।' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (decoded.role === "admin" && decoded.id === "temporary-admin") {`r`n      req.agent = { id: "temporary-admin", username: process.env.ADMIN_USERNAME || "admin", role: "admin", temporary: true };`r`n      return next();`r`n    }`r`n    const [users] = await pool.query('SELECT id, phone, full_name, balance, hold_balance, status FROM users WHERE id = ?', [decoded.id]);
    
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'ইউজার পাওয়া যায়নি।' });
    }

    if (users[0].status === 'banned') {
      return res.status(403).json({ success: false, message: 'আপনার অ্যাকাউন্ট ব্যান করা হয়েছে।' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'টোকেন বৈধ নয়।' });
  }
};

export const protectAdmin = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'অননুমোদিত।' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (decoded.role === "admin" && decoded.id === "temporary-admin") {`r`n      req.agent = { id: "temporary-admin", username: process.env.ADMIN_USERNAME || "admin", role: "admin", temporary: true };`r`n      return next();`r`n    }`r`n    const [agents] = await pool.query('SELECT * FROM agents WHERE id = ? AND status = "active"', [decoded.id]);
    
    if (agents.length === 0) {
      return res.status(401).json({ success: false, message: 'অননুমোদিত অ্যাকসেস।' });
    }

    req.agent = agents[0];
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'টোকেন বৈধ নয়।' });
  }
};
