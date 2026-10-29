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

const router = express.Router();

router.post('/login', adminLogin);
router.get('/dashboard', protectAdmin, dashboard);
router.get('/users', protectAdmin, getAllUsers);
router.post('/users/:id/balance', protectAdmin, updateUserBalance);
router.post('/users/:id/ban', protectAdmin, toggleUserBan);
router.get('/deposits', protectAdmin, getDepositRequests);
router.post('/deposits/:id/approve', protectAdmin, approveDeposit);
router.post('/deposits/:id/reject', protectAdmin, rejectDeposit);
router.get('/withdraws', protectAdmin, getWithdrawRequests);
router.post('/withdraws/:id/paid', protectAdmin, markWithdrawPaid);
router.post('/withdraws/:id/reject', protectAdmin, rejectWithdraw);
router.get('/settings', protectAdmin, getSettings);
router.post('/settings', protectAdmin, updateSettings);
router.get('/rooms', protectAdmin, getAllRooms);
router.get('/chats/:roomId', protectAdmin, getChatLogs);

export default router;
