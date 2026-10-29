import express from 'express';
import { getSettings, createDeposit, getMyDeposits } from '../controllers/depositController.js';
import { createWithdraw, getMyWithdraws } from '../controllers/withdrawController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/settings', getSettings);
router.post('/deposit', protect, createDeposit);
router.get('/deposit', protect, getMyDeposits);
router.post('/withdraw', protect, createWithdraw);
router.get('/withdraw', protect, getMyWithdraws);

export default router;
