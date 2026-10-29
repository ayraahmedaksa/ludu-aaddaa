import pool from '../config/db.js';
import { generateRoomCode } from '../utils/helpers.js';

export const getRooms = async (req, res) => {
  try {
    const [settings] = await pool.query('SELECT `key`,`value` FROM settings WHERE `key` IN ("min_bet","max_bet","table_fee_per_player")');
    const config = {};
    settings.forEach(s => config[s.key] = s.value);

    const [rooms] = await pool.query(
      `SELECT r.*, u.phone as creator_phone 
       FROM rooms r 
       LEFT JOIN users u ON JSON_CONTAINS(r.players, CAST(u.id AS JSON), '$') 
       WHERE r.status = 'waiting' 
       ORDER BY r.bet_amount ASC, r.created_at ASC 
       LIMIT 50`
    );
    
    res.json({ success: true, rooms, config });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const createRoom = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const { bet_amount } = req.body;
    const userId = req.user.id;
    
    const [settings] = await conn.query('SELECT `key`,`value` FROM settings WHERE `key` IN ("min_bet","max_bet","table_fee_per_player")');
    const config = {};
    settings.forEach(s => config[s.key] = Number(s.value));
    
    if (!bet_amount || bet_amount < config.min_bet || bet_amount > config.max_bet) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `বেট ${config.min_bet} - ${config.max_bet} টাকার মধ্যে হতে হবে।` });
    }
    
    const tableFee = config.table_fee_per_player;
    const required = Number(bet_amount) + Number(tableFee);
    
    const [users] = await conn.query('SELECT balance, hold_balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    const user = users[0];
    
    if (Number(user.balance) < required) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `রুম তৈরি করতে ${required} টাকা প্রয়োজন (বেট ${bet_amount} + টেবিল ফি ${tableFee})` });
    }
    
    // Check if user already in waiting room
    const [existing] = await conn.query(
      `SELECT id FROM rooms WHERE status = 'waiting' AND JSON_CONTAINS(players, CAST(? AS JSON), '$')`,
      [userId]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'আপনি ইতিমধ্যে কোন রুমে রয়েছেন।' });
    }
    
    const roomCode = generateRoomCode();
    const players = [userId];
    
    // Hold bet + table fee
    await conn.query('UPDATE users SET balance = balance - ?, hold_balance = hold_balance + ? WHERE id = ?', [required, required, userId]);
    await conn.query(
      'INSERT INTO balance_log (user_id, type, amount, balance_before, balance_after, description, reference_type) VALUES (?, "hold", ?, ?, ?, ?, "bet")',
      [userId, required, user.balance, Number(user.balance) - required, `রুম তৈরি - ${roomCode} (বেট ${bet_amount} + ফি ${tableFee})`]
    );
    
    const [result] = await conn.query(
      `INSERT INTO rooms (room_code, bet_amount, table_fee, players, current_players, status) VALUES (?, ?, ?, ?, 1, 'waiting')`,
      [roomCode, bet_amount, tableFee, JSON.stringify(players)]
    );
    
    await conn.commit();
    res.status(201).json({ success: true, message: 'রুম তৈরি সফল হয়েছে।', roomCode, roomId: result.insertId });
  } catch (error) {
    await conn.rollback();
    console.error('Create room error:', error);
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  } finally {
    conn.release();
  }
};

export const joinRoom = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const { roomCode } = req.params;
    const userId = req.user.id;
    
    const [rooms] = await conn.query('SELECT * FROM rooms WHERE room_code = ? AND status = "waiting" FOR UPDATE', [roomCode]);
    if (rooms.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'রুম পাওয়া যায়নি বা পূর্ণ হয়ে গেছে।' });
    }
    
    const room = rooms[0];
    const players = JSON.parse(room.players || '[]');
    
    if (players.includes(userId)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'আপনি ইতিমধ্যে এই রুমে রয়েছেন।' });
    }
    
    if (players.length >= room.max_players) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'রুম পূর্ণ হয়ে গেছে।' });
    }
    
    // Check if user in another room
    const [existing] = await conn.query(
      `SELECT id FROM rooms WHERE status = 'waiting' AND JSON_CONTAINS(players, CAST(? AS JSON), '$')`,
      [userId]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'আপনি ইতিমধ্যে কোন রুমে রয়েছেন।' });
    }
    
    const required = Number(room.bet_amount) + Number(room.table_fee);
    const [users] = await conn.query('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    
    if (Number(users[0].balance) < required) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `জয়েন করতে ${required} টাকা প্রয়োজন।` });
    }
    
    // Hold
    await conn.query('UPDATE users SET balance = balance - ?, hold_balance = hold_balance + ? WHERE id = ?', [required, required, userId]);
    await conn.query(
      'INSERT INTO balance_log (user_id, type, amount, balance_before, balance_after, description, reference_type) VALUES (?, "hold", ?, ?, ?, ?, "bet")',
      [userId, required, users[0].balance, Number(users[0].balance) - required, `রুম জয়েন - ${roomCode}`]
    );
    
    players.push(userId);
    const newCount = players.length;
    const newStatus = newCount >= room.max_players ? 'playing' : 'waiting';
    
    await conn.query(
      'UPDATE rooms SET players = ?, current_players = ?, status = ?, started_at = IF(?="playing", NOW(), started_at) WHERE id = ?',
      [JSON.stringify(players), newCount, newStatus, newStatus, room.id]
    );
    
    await conn.commit();
    res.json({ success: true, message: 'রুমে সফলভাবে জয়েন করেছেন।', roomCode, status: newStatus });
  } catch (error) {
    await conn.rollback();
    console.error('Join room error:', error);
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  } finally {
    conn.release();
  }
};

export const getRoomDetails = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const [rooms] = await pool.query(
      `SELECT r.*, 
              GROUP_CONCAT(JSON_OBJECT('id', u.id, 'phone', u.phone, 'full_name', u.full_name)) as players_info
       FROM rooms r
       LEFT JOIN users u ON JSON_CONTAINS(r.players, CAST(u.id AS JSON), '$')
       WHERE r.room_code = ?
       GROUP BY r.id`,
      [roomCode]
    );
    
    if (rooms.length === 0) {
      return res.status(404).json({ success: false, message: 'রুম পাওয়া যায়নি।' });
    }
    
    res.json({ success: true, room: rooms[0] });
  } catch (error) {
    console.error('Room details error:', error);
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  }
};

export const leaveRoom = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { roomCode } = req.params;
    const userId = req.user.id;
    
    const [rooms] = await conn.query('SELECT * FROM rooms WHERE room_code = ? AND status = "waiting" FOR UPDATE', [roomCode]);
    if (rooms.length === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'এই রুম থেকে বের হওয়া সম্ভব নয়।' });
    }
    
    const room = rooms[0];
    const players = JSON.parse(room.players || '[]');
    if (!players.includes(userId)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'আপনি এই রুমে নেই।' });
    }
    
    const required = Number(room.bet_amount) + Number(room.table_fee);
    const [users] = await conn.query('SELECT balance, hold_balance FROM users WHERE id = ? FOR UPDATE', [userId]);
    
    // Refund
    await conn.query('UPDATE users SET balance = balance + ?, hold_balance = hold_balance - ? WHERE id = ?', [required, required, userId]);
    await conn.query(
      'INSERT INTO balance_log (user_id, type, amount, balance_before, balance_after, description, reference_type) VALUES (?, "refund", ?, ?, ?, ?, "bet")',
      [userId, required, users[0].balance, Number(users[0].balance) + required, `রুম ছাড় - ${roomCode} (ফেরত)`]
    );
    
    const newPlayers = players.filter(p => p != userId);
    if (newPlayers.length === 0) {
      await conn.query('DELETE FROM rooms WHERE id = ?', [room.id]);
    } else {
      await conn.query('UPDATE rooms SET players = ?, current_players = ? WHERE id = ?', [JSON.stringify(newPlayers), newPlayers.length, room.id]);
    }
    
    await conn.commit();
    res.json({ success: true, message: 'রুম থেকে বের হয়ে গেছেন। টাকা ফেরত দেওয়া হয়েছে।' });
  } catch (error) {
    await conn.rollback();
    console.error('Leave room error:', error);
    res.status(500).json({ success: false, message: 'সার্ভার এরর।' });
  } finally {
    conn.release();
  }
};

export const finishGame = async (roomCode, winnerId) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    const [rooms] = await conn.query('SELECT * FROM rooms WHERE room_code = ? AND status = "playing" FOR UPDATE', [roomCode]);
    if (rooms.length === 0) {
      await conn.rollback();
      return;
    }
    
    const room = rooms[0];
    const players = JSON.parse(room.players || '[]');
    if (players.length < 2 || !players.includes(winnerId)) {
      await conn.rollback();
      return;
    }
    
    const loserId = players.find(p => p != winnerId);
    const betAmount = Number(room.bet_amount);
    const tableFee = Number(room.table_fee);
    const pot = betAmount * 2;
    const totalFee = tableFee * 2;
    const winAmount = pot - totalFee;
    
    // Release hold for both
    await conn.query('UPDATE users SET hold_balance = hold_balance - ? WHERE id IN (?, ?)', [betAmount + tableFee, winnerId, loserId]);
    
    // Give win to winner
    const [winner] = await conn.query('SELECT balance FROM users WHERE id = ? FOR UPDATE', [winnerId]);
    await conn.query('UPDATE users SET balance = balance + ? WHERE id = ?', [winAmount, winnerId]);
    await conn.query(
      'INSERT INTO balance_log (user_id, type, amount, balance_before, balance_after, description, reference_type) VALUES (?, "credit", ?, ?, ?, ?, "win")',
      [winnerId, winAmount, winner[0].balance, Number(winner[0].balance) + winAmount, `জয় - ${roomCode} (পট ${pot} - ফি ${totalFee})`]
    );
    
    // Record history
    await conn.query(
      'INSERT INTO game_history (room_id, room_code, player_id, opponent_id, bet_amount, table_fee, result, amount_won, amount_lost) VALUES (?, ?, ?, ?, ?, ?, "win", ?, 0), (?, ?, ?, ?, ?, "lose", 0, ?)',
      [room.id, roomCode, winnerId, loserId, betAmount, tableFee, winAmount, room.id, roomCode, loserId, winnerId, betAmount, tableFee, betAmount + tableFee]
    );
    
    await conn.query('UPDATE rooms SET status = "finished", winner_id = ?, pot_amount = ?, table_fee_total = ?, win_amount = ?, finished_at = NOW() WHERE id = ?', [winnerId, pot, totalFee, winAmount, room.id]);
    
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    console.error('Finish game error:', error);
  } finally {
    conn.release();
  }
};
