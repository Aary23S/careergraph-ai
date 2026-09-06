import express from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler, ok } from '../lib/http.js';
import { importFollowedCompaniesCsv, importFollowedCompaniesPdf } from '../services/followed-company.service.js';

const router = express.Router();
const upload = multer();

router.use(requireAuth);

router.post(
  '/import',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: { code: 'FILE_REQUIRED', message: 'File is required' } });
    }

    const isPdf = file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf');
    
    let result;
    if (isPdf) {
      result = await importFollowedCompaniesPdf(req.auth.userId, file.buffer);
    } else {
      const csvContent = file.buffer.toString('utf8');
      result = await importFollowedCompaniesCsv(req.auth.userId, csvContent);
    }

    ok(res, { message: 'Import successful', imported: result.imported });
  })
);

export default router;
