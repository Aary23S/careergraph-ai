import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/http.js';
import { ColdEmailController } from '../controllers/cold-email.controller.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', asyncHandler(ColdEmailController.getColdEmails));
router.get('/stats', asyncHandler(ColdEmailController.getStats));
router.post('/sync', asyncHandler(ColdEmailController.syncColdEmails));
router.post('/sync-gmail', asyncHandler(ColdEmailController.syncFromGmail));
router.post('/', asyncHandler(ColdEmailController.createColdEmail));
router.post('/:id/revert', asyncHandler(ColdEmailController.logRevert));
router.post('/:id/link', asyncHandler(ColdEmailController.linkToCRM));

export default router;
