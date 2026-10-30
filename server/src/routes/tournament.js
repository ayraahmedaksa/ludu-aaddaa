import express from 'express';
import { listTournaments, joinTournament } from '../controllers/tournamentController.js';
const router = express.Router();
router.get('/', listTournaments);
router.post('/:id/join', joinTournament);
export default router;
