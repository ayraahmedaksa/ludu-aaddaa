import express from 'express';
import { protectAdmin } from '../middleware/auth.js';
import { 
  adminLogin, 
  dashboard, 
  getAllUsers, 
  updateUserBalance, 
  toggleUserBan,
  getDepositRequests,
  approveDeposit,
  rejectDeposit,
  getWithdrawRequests,
  markWithdrawPaid,
  rejectWithdraw,
  getSettings,
  updateSettings,
  getAllRooms,
  getChatLogs
} from '../controllers/adminController.js';
import * as supabaseAdmin from '../controllers/supabaseAdminController.js';

const router = express.Router();

router.post('/login', adminLogin);
router.get('/dashboard', protectAdmin, supabaseAdmin.dashboard);
router.get('/supabase/dashboard', protectAdmin, supabaseAdmin.dashboard);
router.get('/supabase/users', protectAdmin, supabaseAdmin.users);
router.get('/supabase/deposits', protectAdmin, supabaseAdmin.deposits);
router.get('/supabase/withdrawals', protectAdmin, supabaseAdmin.withdrawals);
router.get('/supabase/rooms', protectAdmin, supabaseAdmin.rooms);
router.get('/users', protectAdmin, supabaseAdmin.users);
router.post('/users/:id/balance', protectAdmin, updateUserBalance);
router.post('/users/:id/ban', protectAdmin, toggleUserBan);
router.get('/deposits', protectAdmin, supabaseAdmin.deposits);
router.post('/deposits/:id/approve', protectAdmin, approveDeposit);
router.post('/deposits/:id/reject', protectAdmin, rejectDeposit);
router.get('/withdraws', protectAdmin, supabaseAdmin.withdrawals);
router.post('/withdraws/:id/paid', protectAdmin, markWithdrawPaid);
router.post('/withdraws/:id/reject', protectAdmin, rejectWithdraw);
router.get('/settings', protectAdmin, getSettings);
router.post('/settings', protectAdmin, updateSettings);
router.get('/rooms', protectAdmin, supabaseAdmin.rooms);
router.post('/tournaments', protectAdmin, supabaseAdmin.createTournament);
router.post('/supabase/deposits/:id/approve', protectAdmin, supabaseAdmin.approveDeposit);
router.post('/supabase/deposits/:id/reject', protectAdmin, supabaseAdmin.rejectDeposit);
router.post('/supabase/withdraws/:id/paid', protectAdmin, supabaseAdmin.payWithdrawal);
router.post('/supabase/withdraws/:id/reject', protectAdmin, supabaseAdmin.rejectWithdrawal);
router.get('/chats/:roomId', protectAdmin, getChatLogs);

export default router;
