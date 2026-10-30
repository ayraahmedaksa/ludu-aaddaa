import express from 'express';
import { listTournaments } from '../controllers/tournamentController.js';
const router = express.Router();
router.get('/', listTournaments);
export default router;
